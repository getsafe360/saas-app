// lib/wordpress/site-access.ts
//
// Loads a site for the signed-in owner, with its connector credentials.
// Fails closed: no user row, another owner or no connection → an error response.

import 'server-only';

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';

export interface OwnedSite {
  id: string;
  siteUrl: string;
  tokenHash: string | null;
  connected: boolean;
}

export async function loadOwnedSite(
  siteId: string,
  options: { requireConnection?: boolean } = {},
): Promise<{ site: OwnedSite; tokenHash: string } | { site: OwnedSite; tokenHash: null } | { error: NextResponse }> {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 }) };

  const db = getDrizzle();
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const [row] = await db
    .select({
      id: sites.id,
      userId: sites.userId,
      siteUrl: sites.siteUrl,
      tokenHash: sites.tokenHash,
      wordpressConnection: sites.wordpressConnection,
      isConnected: sites.isConnected,
      connectionStatus: sites.connectionStatus,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!row) return { error: NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 }) };
  if (!dbUser || row.userId !== dbUser.id) {
    return { error: NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 }) };
  }
  const tokenHash = row.tokenHash || ((row.wordpressConnection as { tokenHash?: string } | null)?.tokenHash ?? null);
  const connected = Boolean(tokenHash && row.isConnected && row.connectionStatus === 'connected');
  const site: OwnedSite = { id: row.id, siteUrl: row.siteUrl, tokenHash, connected };
  if (options.requireConnection && !connected) {
    return { error: NextResponse.json({ success: false, error: 'WORDPRESS_NOT_CONNECTED' }, { status: 422 }) };
  }
  return { site, tokenHash: connected ? tokenHash : null } as { site: OwnedSite; tokenHash: string };
}
