// GET /api/sites/[id]/wordpress/changes
//
// Connector changes made to this site, newest first, with whether each can be
// undone right now (see lib/wordpress/applied-changes.ts).

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { PERMANENT_FIXER_IDS } from '@/lib/engine/fixers/catalog';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { wordpressActionRuns } from '@/lib/db/schema/wordpress/agent';
import { toAppliedChanges } from '@/lib/wordpress/applied-changes';

export const dynamic = 'force-dynamic';

/**
 * Only runs that changed the site carry an inverse, so filtering on it in SQL
 * keeps skipped and no-op runs from crowding real changes out of the limit.
 * The limit still leaves enough history to decide undo order.
 */
const HISTORY_LIMIT = 200;

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = getDrizzle();
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const [site] = await db
    .select({ id: sites.id, userId: sites.userId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }
  // Fail closed: without a matching user row we cannot prove ownership.
  if (!dbUser || site.userId !== dbUser.id) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const runs = await db
    .select({
      id: wordpressActionRuns.id,
      actionId: wordpressActionRuns.actionId,
      title: wordpressActionRuns.title,
      status: wordpressActionRuns.status,
      rollbackPayload: wordpressActionRuns.rollbackPayload,
      inputPayload: wordpressActionRuns.inputPayload,
      verificationOk: wordpressActionRuns.verificationOk,
      startedAt: wordpressActionRuns.startedAt,
      completedAt: wordpressActionRuns.completedAt,
    })
    .from(wordpressActionRuns)
    .where(
      and(
        eq(wordpressActionRuns.siteId, siteId),
        inArray(wordpressActionRuns.status, ['applied', 'failed', 'rolled_back']),
        or(
          and(
            isNotNull(wordpressActionRuns.rollbackPayload),
            sql`${wordpressActionRuns.rollbackPayload} <> 'null'::jsonb`,
          ),
          // One-way changes (database cleanup, default role) have no inverse but did change the site.
          and(
            eq(wordpressActionRuns.status, 'applied'),
            inArray(wordpressActionRuns.actionId, [...PERMANENT_FIXER_IDS]),
          ),
        ),
      ),
    )
    .orderBy(desc(wordpressActionRuns.startedAt))
    .limit(HISTORY_LIMIT);

  return NextResponse.json(
    { success: true, changes: toAppliedChanges(runs) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
