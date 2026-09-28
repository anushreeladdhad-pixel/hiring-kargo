import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'kargo_access';

export function middleware(req: NextRequest) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return NextResponse.next(); // no code configured -> open

  if (req.nextUrl.pathname.startsWith('/unlock')) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/unlock')) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/_next')) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === code) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
