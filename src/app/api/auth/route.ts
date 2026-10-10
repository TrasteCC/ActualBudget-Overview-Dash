import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/auth';

export async function POST(req: Request) {
  const expected = process.env.DASH_PASSWORD;
  if (!expected) return NextResponse.json({ success: true });
  let password = '';
  try { ({ password } = await req.json()); } catch { /* fall through */ }
  if (password !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
