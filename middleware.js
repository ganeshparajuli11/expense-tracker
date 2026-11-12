import { NextResponse } from 'next/server';
import { COOKIE, sessionToken, safeEqual } from './lib/auth.js';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get(COOKIE)?.value;
  const ok = Boolean(process.env.APP_PASSWORD) && safeEqual(cookie, await sessionToken());
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Everything is protected except the login page, the Claude connector (it has its own secret),
// static files and the app icons/manifest.
export const config = {
  matcher: [
    '/((?!login|api/login|api/mcp|_next|\\.well-known|manifest\\.webmanifest|sw\\.js|icons|favicon\\.ico|apple-icon).*)',
  ],
};
