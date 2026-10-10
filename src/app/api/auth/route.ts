import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

export async function POST(req: Request) {
  const expected = process.env.DASH_PASSWORD;
  if (!expected) return NextResponse.json({ success: true });
  let password = '';
  try { ({ password } = await req.json()); } catch { /* fall through */ }
  if (password !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = NextResponse.json({ success: true });
  // Secure only when the browser came over HTTPS (directly or through a TLS-terminating proxy), so a
  // plain http://<host>:3000 install can still log in.
  const https = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  res.cookies.set(COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: https,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
