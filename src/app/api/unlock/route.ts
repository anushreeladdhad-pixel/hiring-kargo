import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { code, next } = await req.json();
  const expected = process.env.APP_ACCESS_CODE;

  if (!expected || code !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next: next || '/' });
  res.cookies.set('kargo_access', expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
