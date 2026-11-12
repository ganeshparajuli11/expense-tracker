import { NextResponse } from 'next/server';
import { COOKIE, sessionToken, safeEqual } from '@/lib/auth';

export async function POST(req) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'APP_PASSWORD is not set in Vercel environment variables.' }, { status: 500 });
  }
  const { password } = await req.json().catch(() => ({}));
  if (!safeEqual(password, process.env.APP_PASSWORD)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
