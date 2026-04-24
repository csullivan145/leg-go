import { Hono } from 'hono';
import { extractText, getDocumentProxy } from 'unpdf';
import type { Env } from '../env';

const parseRoutes = new Hono<{ Bindings: Env }>();

interface ExtractedBooking {
  // Accommodation fields
  name: string | null;
  city: string | null;
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

  // Travel fields
  transport_type: 'flight' | 'train' | 'ferry' | 'car' | 'bus' | null;
  cost: number | null;
  duration: string | null;
  stops: number | null;
  company: string | null;
  start_date: string | null;
  end_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string | null;
  arrival_location: string | null;
}

const EMPTY: ExtractedBooking = {
  name: null,
  city: null,
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
  transport_type: null,
  cost: null,
  duration: null,
  stops: null,
  company: null,
  start_date: null,
  end_date: null,
  departure_time: null,
  arrival_time: null,
  departure_location: null,
  arrival_location: null,
};

function buildExtractionPrompt(currentYear: number): string {
  return `You are parsing a travel booking confirmation — either a TRANSPORT booking (flight, train, ferry, car rental, bus) OR an ACCOMMODATION booking (hotel, Airbnb). Extract every field below that appears in the document, return ONLY a JSON object, no text, no code fences.

Shape (use null only when the document truly does not show that field):
{
  "transport_type": "flight" | "train" | "ferry" | "car" | "bus" | null,
  "company": string | null,
  "booking_id": string | null,
  "booking_link": string | null,
  "start_date": string | null,
  "end_date": string | null,
  "departure_time": string | null,
  "arrival_time": string | null,
  "departure_location": string | null,
  "arrival_location": string | null,
  "duration": string | null,
  "stops": number | null,
  "cost": number | null,
  "name": string | null,
  "city": string | null,
  "address": string | null,
  "check_in_date": string | null,
  "check_out_date": string | null,
  "check_in_time": string | null,
  "check_out_time": string | null,
  "cost_per_night": number | null,
  "total_cost": number | null,
  "nights": number | null
}

Rules:
- Dates: YYYY-MM-DD. Times: 24-hour HH:MM.
- If a date has no year (e.g. "Jun 30"), assume year ${currentYear}. If the arrival/check-out month is earlier than the departure/check-in month, the later date rolls into ${currentYear + 1}.
- Strip currency symbols; amounts are plain numbers.

Transport (flights / trains / ferries / buses / car rentals) — extract aggressively when these fields appear:
- "transport_type": map to one of flight/train/ferry/car/bus. Flight confirmations almost always imply "flight".
- "company": the carrier name (airline, rail operator, ferry line, rental brand). e.g. "United Airlines", "Swiss", "Ryanair", "Trenitalia".
- "booking_id": reservation / confirmation code / PNR / airline reference / booking reference — short alphanumeric (e.g. "MT1KYD"). NOT the trip ID or agency reference.
- "start_date": date of DEPARTURE in YYYY-MM-DD. Find the travel date on the ticket (often written like "Mon, Jun 29, 2026"). DO NOT use the booked/purchase date (often labeled "Booked: ..." or at the top of the page — that is when the ticket was bought, not when you fly).
- "end_date": date of ARRIVAL. If the confirmation says "next day arrival" or the arrival is the day after departure, end_date = start_date + 1. If same-day, end_date equals start_date.
- "departure_time": departure time in 24h HH:MM. Convert "6:30 pm" to "18:30", "11:00 am" to "11:00".
- "arrival_time": arrival time in 24h HH:MM. Same conversion rule.
- "departure_location"/"arrival_location": airport / station / port names or IATA codes (e.g. "EWR", "FLR", "Roma Termini"). Fill BOTH when the document shows a from → to.
- "duration": human-readable like "10h 30m" or "9h 40m".
- "stops": integer (0 for non-stop, 1 for one layover, etc.).
- "cost": fare as a number (strip "$"); if the document shows total cost and per-person cost, use the total.

Accommodation (hotel / Airbnb):
- "name": property name, "city", "address".
- "check_in_date"/"check_out_date"/"check_in_time"/"check_out_time".
- "cost_per_night" or "total_cost".

STRICT OUTPUT RULES — you MUST follow these:
- Your entire response must be ONLY a single JSON object. No markdown. No bullet points. No asterisks. No headers. No prose before or after.
- Use double-quoted keys exactly matching the shape above.
- Start your response with "{" and end with "}".

Example of a correct response for a flight confirmation:
{"transport_type":"flight","company":"United Airlines","booking_id":"MT1KYD","start_date":"2026-06-29","end_date":"2026-06-30","departure_time":"18:30","arrival_time":"11:00","departure_location":"EWR","arrival_location":"FLR","duration":"10h 30m","stops":1,"cost":1870,"name":null,"city":null,"address":null,"check_in_date":null,"check_out_date":null,"check_in_time":null,"check_out_time":null,"cost_per_night":null,"total_cost":null,"nights":null,"booking_link":null}`;
}

// Map human labels the model sometimes emits to our canonical field names.
const LABEL_TO_FIELD: Record<string, keyof ExtractedBooking> = {
  type: 'transport_type',
  'transport type': 'transport_type',
  company: 'company',
  carrier: 'company',
  airline: 'company',
  'booking id': 'booking_id',
  'booking reference': 'booking_id',
  'confirmation code': 'booking_id',
  'confirmation number': 'booking_id',
  'reference number': 'booking_id',
  pnr: 'booking_id',
  'booking link': 'booking_link',
  'start date': 'start_date',
  'departure date': 'start_date',
  'end date': 'end_date',
  'arrival date': 'end_date',
  'departure time': 'departure_time',
  'arrival time': 'arrival_time',
  'departure location': 'departure_location',
  from: 'departure_location',
  'arrival location': 'arrival_location',
  to: 'arrival_location',
  duration: 'duration',
  stops: 'stops',
  cost: 'cost',
  fare: 'cost',
  price: 'cost',
  name: 'name',
  'property name': 'name',
  'hotel name': 'name',
  city: 'city',
  address: 'address',
  'check in date': 'check_in_date',
  'check-in date': 'check_in_date',
  'check out date': 'check_out_date',
  'check-out date': 'check_out_date',
  'check in time': 'check_in_time',
  'check-in time': 'check_in_time',
  'check out time': 'check_out_time',
  'check-out time': 'check_out_time',
  'cost per night': 'cost_per_night',
  'nightly rate': 'cost_per_night',
  'total cost': 'total_cost',
  total: 'total_cost',
  nights: 'nights',
};

const NUMERIC_FIELDS = new Set<keyof ExtractedBooking>([
  'cost',
  'cost_per_night',
  'total_cost',
  'nights',
  'stops',
]);

function parseMarkdownFallback(text: string): Partial<ExtractedBooking> {
  const out: Partial<ExtractedBooking> = {};
  // Match patterns like:
  //   * **Type**: flight
  //   - Company: United Airlines
  //   Name: Hotel Lisboa
  const lineRe = /^\s*[*\-•]?\s*\**\s*([A-Za-z][A-Za-z\- ]{1,30})\s*\**\s*[:=]\s*(.+?)\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const label = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const rawValue = m[2].trim().replace(/^\**\s*/, '').replace(/\s*\**$/, '');
    if (!rawValue || rawValue.toLowerCase() === 'null' || rawValue === '-') continue;
    const field = LABEL_TO_FIELD[label];
    if (!field) continue;
    if (NUMERIC_FIELDS.has(field)) {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) (out as Record<string, unknown>)[field] = num;
    } else {
      (out as Record<string, unknown>)[field] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function extractJson(text: unknown): Partial<ExtractedBooking> {
  const s = typeof text === 'string' ? text : '';
  if (!s) return {};
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : s;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1)) as Partial<ExtractedBooking>;
    } catch {
      // fall through to markdown parser
    }
  }
  // Fallback: the model returned markdown/key-value pairs instead of JSON
  return parseMarkdownFallback(s);
}

async function extractFromImage(ai: Env['AI'], bytes: Uint8Array): Promise<string> {
  const image = Array.from(bytes);
  const res = (await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
    prompt: buildExtractionPrompt(new Date().getUTCFullYear()),
    image,
    max_tokens: 1024,
  } as never)) as unknown;
  console.log('[parse/booking] vision raw res:', JSON.stringify(res).slice(0, 300));
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    const r = res as { response?: unknown; description?: unknown };
    if (typeof r.response === 'string') return r.response;
    if (typeof r.description === 'string') return r.description;
  }
  return '';
}

async function extractFromPdf(ai: Env['AI'], bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = extracted?.text;
  const textContent = Array.isArray(text) ? text.join('\n') : (typeof text === 'string' ? text : '');
  if (!textContent) return '';
  const truncated = textContent.length > 12000 ? textContent.slice(0, 12000) : textContent;

  const res = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: buildExtractionPrompt(new Date().getUTCFullYear()) },
      { role: 'user', content: truncated },
    ],
    max_tokens: 1024,
  } as never)) as unknown;
  console.log('[parse/booking] pdf raw res:', JSON.stringify(res).slice(0, 300));
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    const r = res as { response?: unknown };
    if (typeof r.response === 'string') return r.response;
  }
  return '';
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
    console.log(`[parse/booking] isPdf=${isPdf} size=${bytes.byteLength}`);
    const rawText = isPdf
      ? await extractFromPdf(c.env.AI, bytes)
      : await extractFromImage(c.env.AI, bytes);
    console.log(`[parse/booking] rawText length=${rawText.length}`);

    const merged: ExtractedBooking = { ...EMPTY, ...extractJson(rawText) };
    return c.json({ data: merged, raw: rawText });
  } catch (err) {
    console.error('[parse/booking] failed:', err);
    return c.json({ error: 'Extraction failed', detail: String(err) }, 500);
  }
});

export default parseRoutes;
