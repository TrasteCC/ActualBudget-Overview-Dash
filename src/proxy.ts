import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

// Read-only endpoints other dashboards may poll with `Authorization: Bearer <API_TOKEN>`.
const TOKEN_PATHS = ['/api/overview', '/api/summary'];

// Single shared password. With DASH_PASSWORD unset the dashboard is open (LAN-only setups).
export async function proxy(request: NextRequest) {
  const password = process.env.DASH_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const apiToken = process.env.API_TOKEN;
  if (apiToken && request.method === 'GET' && TOKEN_PATHS.includes(pathname)
    && request.headers.get('authorization') === `Bearer ${apiToken}`) {
    return NextResponse.next();
  }
  const authed = request.cookies.get(COOKIE)?.value === await sessionToken(password);
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
