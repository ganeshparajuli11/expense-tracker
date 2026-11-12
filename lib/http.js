import { NextResponse } from 'next/server';

export function ok(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(e, status = 400) {
  return NextResponse.json({ error: e?.message || String(e) }, { status });
}
