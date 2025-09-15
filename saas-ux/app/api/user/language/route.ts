import {NextResponse} from 'next/server';

const ALLOWED = ['en','de','es','fr','it','pt'] as const;

export async function POST(req: Request) {
  let locale: string | undefined;

  try {
    const body = await req.json();
    locale = body?.locale;
  } catch {
    // no JSON body
  }

  if (!locale || !ALLOWED.includes(locale as any)) {
    return NextResponse.json({error: 'Invalid or missing locale'}, {status: 400});
  }

  const res = NextResponse.json({ok: true});
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  });
  return res;
}