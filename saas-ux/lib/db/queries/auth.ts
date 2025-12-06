import 'server-only';
import { cache } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { cookies as nextCookies } from 'next/headers';
import { getDb } from '../drizzle';
import { users } from '@/lib/db/schema/auth/users';
import { verifyToken } from '@/lib/auth/session';

// handles sync/async cookies() implementations
async function getSessionCookie() {
  const jarOrPromise = (nextCookies as unknown as () => any)();
  const jar = typeof (jarOrPromise?.then) === 'function' ? await jarOrPromise : jarOrPromise;
  return jar?.get?.('session') ?? null;
}

/** Current session's user (or null). */
export async function getUser() {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie?.value) return null;

  const session = await verifyToken(sessionCookie.value);
  if (!session?.user || typeof session.user.id !== 'number') return null;
  if (new Date(session.expires) < new Date()) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      language: users.language,
    })
    .from(users)
    .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new Error('User not authenticated');
  return u;
}

// Optional helper for RSC
export const getUserCached = cache(getUser);
