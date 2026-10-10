import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE } from '@/lib/auth';

// Single shared password. With DASH_PASSWORD unset the dashboard is open (LAN-only setups).
export function proxy(request: NextRequest) {
  if (!process.env.DASH_PASSWORD) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get(COOKIE)?.value === 'authenticated';
  if (pathname === '/login') {
    return authed ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (!authed) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
