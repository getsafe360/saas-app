// lib/wordpress/change-runs.ts
//
// The action runs that changed a site, as toAppliedChanges() reads them. Shared
// by Applied changes and the client reports.

import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { PERMANENT_FIXER_IDS } from '@/lib/engine/fixers/catalog';
import type { getDrizzle } from '@/lib/db/postgres';
import { wordpressActionRuns } from '@/lib/db/schema/wordpress/agent';
import type { ActionRunRow } from './applied-changes';

/**
 * Only runs that changed the site carry an inverse, so filtering on it in SQL
 * keeps skipped and no-op runs from crowding real changes out of the limit.
 */
export async function loadChangeRuns(
  db: ReturnType<typeof getDrizzle>,
  siteId: string,
  limit: number,
): Promise<ActionRunRow[]> {
  return db
    .select({
      id: wordpressActionRuns.id,
      actionId: wordpressActionRuns.actionId,
      title: wordpressActionRuns.title,
      status: wordpressActionRuns.status,
      rollbackPayload: wordpressActionRuns.rollbackPayload,
      inputPayload: wordpressActionRuns.inputPayload,
      resultPayload: wordpressActionRuns.resultPayload,
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
          // One-way changes (database cleanup, default role) have no inverse but did change the site,
          // including when the live check afterwards failed (toAppliedChanges confirms the connector applied it).
          inArray(wordpressActionRuns.actionId, [...PERMANENT_FIXER_IDS]),
        ),
      ),
    )
    .orderBy(desc(wordpressActionRuns.startedAt))
    .limit(limit) as Promise<ActionRunRow[]>;
}
