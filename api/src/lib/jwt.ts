const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${base64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const key = await getKey(secret);
  const data = `${headerB64}.${payloadB64}`;
  const sig = base64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(data));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
