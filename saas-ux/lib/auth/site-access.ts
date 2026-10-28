import 'server-only';
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { getUser } from '@/lib/db/queries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user's app id (legacy session first, then Clerk), or null. */
async function currentAppUserId(): Promise<number | null> {
  const db = getDb();
  let userId: number | null = null;
  try {
    userId = (await getUser())?.id ?? null; // legacy session
  } catch {
    // fall through to Clerk
  }
  if (!userId) {
    const cu = await currentUser().catch(() => null);
    if (cu) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, cu.id))
        .limit(1);
      userId = row?.id ?? null;
    }
  }
  return userId;
}

export type SiteAccess =
  | { ok: true; userId: number; siteId: string }
  | { ok: false; response: NextResponse };

/**
 * Requires a signed-in user who owns the site.
 *
 *   401 — not signed in
 *   404 — malformed id, no such site, or not yours (deliberately the same answer,
 *         so ids cannot be probed for existence)
 */
export async function requireSiteOwner(siteId: string): Promise<SiteAccess> {
  const db = getDb();

  const userId = await currentAppUserId();

  if (!userId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'SIGN_IN_REQUIRED' }, { status: 401 }) };
  }

  const notFound = { ok: false, response: NextResponse.json({ ok: false, error: 'SITE_NOT_FOUND' }, { status: 404 }) } as const;
  if (!UUID.test(siteId)) return notFound;

  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
    .limit(1);

  return site ? { ok: true, userId, siteId: site.id } : notFound;
}

/**
 * For server-rendered pages: the full site row if it belongs to the signed-in user,
 * otherwise null (callers answer with notFound(), like requireSiteOwner's 404).
 */
export async function getOwnedSite(siteId: string) {
  if (!UUID.test(siteId)) return null;
  const userId = await currentAppUserId();
  if (!userId) return null;

  const [site] = await getDb()
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
    .limit(1);
  return site ?? null;
}
