import { NextResponse } from 'next/server';
import { handleBody } from '@/lib/mcp';
import { safeEqual } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authorized(params) {
  const { key } = await params;
  const secret = process.env.MCP_SECRET;
  return Boolean(secret) && secret.length >= 16 && safeEqual(key, secret);
}

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function POST(req, { params }) {
  if (!(await authorized(params))) return notFound();
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  const out = await handleBody(body);
  if (out === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}

// This server does not open a server-to-client event stream.
export async function GET(_req, { params }) {
  if (!(await authorized(params))) return notFound();
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE(_req, { params }) {
  if (!(await authorized(params))) return notFound();
  return new NextResponse(null, { status: 200 });
}
