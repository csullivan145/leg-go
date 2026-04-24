import { Hono } from 'hono';
import { extractText, getDocumentProxy } from 'unpdf';
import type { Env } from '../env';

const parseRoutes = new Hono<{ Bindings: Env }>();

interface ExtractedBooking {
  name: string | null;
  address: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  total_cost: number | null;
  cost_per_night: number | null;
  booking_id: string | null;
  booking_link: string | null;
  nights: number | null;
}

const EMPTY: ExtractedBooking = {
  name: null,
  address: null,
  check_in_date: null,
  check_out_date: null,
  check_in_time: null,
  check_out_time: null,
  total_cost: null,
  cost_per_night: null,
  booking_id: null,
  booking_link: null,
  nights: null,
};

const EXTRACTION_PROMPT = `You are parsing a booking confirmation (hotel, Airbnb, or similar). Extract the fields below and return ONLY a JSON object, no other text, no code fences.

Required shape (use null for any field you cannot find):
{
  "name": string | null,
  "address": string | null,
  "check_in_date": string | null,
  "check_out_date": string | null,
  "check_in_time": string | null,
  "check_out_time": string | null,
  "total_cost": number | null,
  "cost_per_night": number | null,
  "booking_id": string | null,
  "booking_link": string | null,
  "nights": number | null
}

Rules:
- Dates must be YYYY-MM-DD.
- Times must be 24-hour HH:MM.
- total_cost and cost_per_night are numbers (strip currency symbols).
- name is the property or hotel name (e.g. "Hotel Lisboa" or "Sunny apartment in Alfama").
- booking_id is a reservation / confirmation code.
- Return only the JSON object.`;

function extractJson(text: string): Partial<ExtractedBooking> {
  if (!text) return {};
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return {};
  try {
    return JSON.parse(candidate.slice(first, last + 1)) as Partial<ExtractedBooking>;
  } catch {
    return {};
  }
}

async function extractFromImage(ai: Env['AI'], bytes: Uint8Array): Promise<string> {
  const image = Array.from(bytes);
  const res = (await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
    prompt: EXTRACTION_PROMPT,
    image,
    max_tokens: 512,
  } as never)) as { response?: string; description?: string };
  return res.response ?? res.description ?? '';
}

async function extractFromPdf(ai: Env['AI'], bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const textContent = Array.isArray(text) ? text.join('\n') : text;
  const truncated = textContent.length > 12000 ? textContent.slice(0, 12000) : textContent;

  const res = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: truncated },
    ],
    max_tokens: 512,
  } as never)) as { response?: string };
  return res.response ?? '';
}

// POST /api/parse/booking — accepts an image or PDF, extracts accommodation fields
parseRoutes.post('/parse/booking', async (c) => {
  if (!c.env.AI) return c.json({ error: 'AI binding not configured' }, 500);

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const f = file as File;
  const bytes = new Uint8Array(await f.arrayBuffer());
  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  const isImage = f.type.startsWith('image/');

  if (!isPdf && !isImage) {
    return c.json({ error: 'Unsupported file type — upload an image or PDF' }, 400);
  }

  try {
    const rawText = isPdf
      ? await extractFromPdf(c.env.AI, bytes)
      : await extractFromImage(c.env.AI, bytes);

    const merged: ExtractedBooking = { ...EMPTY, ...extractJson(rawText) };
    return c.json({ data: merged, raw: rawText });
  } catch (err) {
    return c.json({ error: 'Extraction failed', detail: String(err) }, 500);
  }
});

export default parseRoutes;
