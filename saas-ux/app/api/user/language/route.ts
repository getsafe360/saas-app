import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/auth/users';

const ALLOWED = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;

export async function POST(req: Request) {
  let locale: string | undefined;

  try {
    const body = await req.json();
    locale = body?.locale;
  } catch {
    // no JSON body
  }

  if (!locale || !ALLOWED.includes(locale as any)) {
    return NextResponse.json({ error: 'Invalid or missing locale' }, { status: 400 });
  }

  // Signed-in users: persist the choice so emails (and the next device) use it.
  // Failure must not block the cookie below — the UI switch still works.
  try {
    const { userId } = await auth();
    if (userId) {
      await getDb().update(users).set({ language: locale }).where(eq(users.clerkUserId, userId));
    }
  } catch (err) {
    console.error('[user/language] failed to persist language', err);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return res;
}
