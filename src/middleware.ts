import { NextResponse } from 'next/server';

// Access-code gate removed — the app is open to anyone with the link.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
