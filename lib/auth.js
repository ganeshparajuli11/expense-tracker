// Works in both the Edge (middleware) and Node runtimes.
export const COOKIE = 'et_session';

export async function sessionToken() {
  const pw = process.env.APP_PASSWORD || '';
  const data = new TextEncoder().encode(`expense-tracker:${pw}:${process.env.MCP_SECRET || ''}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
