// POST /api/sites/[id]/wordpress/rollback
// Body: { changeSetId: string } or { actionRunIds: string[] }
//
// Undoes applied connector actions by replaying the inverse request each one
// stored, newest first, and records the undo as its own audited change set.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { changeItems, changeSets } from '@/lib/db/schema/copilot/changes';
import { wordpressActionRuns } from '@/lib/db/schema/wordpress/agent';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { createWordPressClient } from '@/lib/wordpress/client';
import { planRollback } from '@/lib/wordpress/rollback';
import { connectorTimeoutFor } from '@/lib/wordpress/timeouts';
import { clearTestState } from '@/lib/security/csp/reports';
import { CSP_TEST_ACTION_ID } from '@/lib/security/csp/start';

type RollbackOutcome = { runId: string; status: 'rolled_back' | 'failed'; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Restoring plugins from restore points can take up to a minute.
export const maxDuration = 300;

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const changeSetId = typeof body?.changeSetId === 'string' && UUID.test(body.changeSetId) ? body.changeSetId : null;
  const actionRunIds: string[] = Array.isArray(body?.actionRunIds)
    ? body.actionRunIds.filter((value: unknown): value is string => typeof value === 'string' && UUID.test(value))
    : [];
  if (!changeSetId && actionRunIds.length === 0) {
    return NextResponse.json({ success: false, error: 'NOTHING_TO_ROLL_BACK' }, { status: 400 });
  }

  const db = getDrizzle();
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const [site] = await db
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

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }
  if (!dbUser || site.userId !== dbUser.id) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const tokenHash =
    site.tokenHash || ((site.wordpressConnection as { tokenHash?: string } | null)?.tokenHash ?? null);
  if (!tokenHash || !site.isConnected || site.connectionStatus !== 'connected') {
    return NextResponse.json({ success: false, error: 'WORDPRESS_NOT_CONNECTED' }, { status: 422 });
  }

  const runs = await db
    .select({
      id: wordpressActionRuns.id,
      actionId: wordpressActionRuns.actionId,
      title: wordpressActionRuns.title,
      status: wordpressActionRuns.status,
      rollbackPayload: wordpressActionRuns.rollbackPayload,
      startedAt: wordpressActionRuns.startedAt,
    })
    .from(wordpressActionRuns)
    .where(
      and(
        eq(wordpressActionRuns.siteId, siteId),
        changeSetId
          ? eq(wordpressActionRuns.changeSetId, changeSetId)
          : inArray(wordpressActionRuns.id, actionRunIds),
      ),
    );

  // Every run of the same fixers on this site, to detect newer changes that
  // replaying an older snapshot would overwrite.
  const fixerIds = [...new Set(runs.map((run) => run.actionId))];
  const siteRuns = fixerIds.length === 0
    ? []
    : await db
        .select({
          id: wordpressActionRuns.id,
          actionId: wordpressActionRuns.actionId,
          status: wordpressActionRuns.status,
          rollbackPayload: wordpressActionRuns.rollbackPayload,
          startedAt: wordpressActionRuns.startedAt,
        })
        .from(wordpressActionRuns)
        .where(and(eq(wordpressActionRuns.siteId, siteId), inArray(wordpressActionRuns.actionId, fixerIds)));

  const { planned, notReversible, blocked } = planRollback(runs, siteRuns);
  if (blocked.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'UNDO_NEWER_CHANGES_FIRST',
        message: 'Newer changes to the same setting are still applied → undo those first.',
        blocked,
      },
      { status: 409 },
    );
  }
  if (planned.length === 0) {
    return NextResponse.json(
      { success: false, error: 'NO_REVERSIBLE_ACTIONS', notReversible },
      { status: 409 },
    );
  }

  publishEvent(siteId, { type: 'repair', state: 'repairing', message: 'Undoing WordPress changes', platform: 'wordpress' });

  const outcomes: RollbackOutcome[] = [];

  // One request at a time: rollback ids can repeat across runs of the same fixer,
  // and order matters when several runs touched the same setting.
  for (const { runId, request: rollbackRequest } of planned) {
    try {
      const client = createWordPressClient({
        siteUrl: site.siteUrl,
        tokenHash,
        timeout: connectorTimeoutFor(rollbackRequest.type),
      });
      const response = await client.applyActions([rollbackRequest]);
      const result = response.results?.find((item) => item.id === rollbackRequest.id);
      const ok = response.success && result?.status === 'applied';
      outcomes.push({
        runId,
        status: ok ? 'rolled_back' : 'failed',
        message: result?.message ?? (ok ? 'Restored.' : 'The connector did not apply the rollback.'),
      });
    } catch (error) {
      outcomes.push({
        runId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Rollback request failed.',
      });
      // Stop: later (older) rollbacks assume this one succeeded.
      break;
    }
    if (outcomes[outcomes.length - 1].status === 'failed') break;
  }

  const rolledBack = outcomes.filter((outcome) => outcome.status === 'rolled_back');
  // Undoing the CSP test ends it: drop its saved policy and reports.
  const rolledBackIds = new Set(rolledBack.map((outcome) => outcome.runId));
  if (runs.some((run) => rolledBackIds.has(run.id) && run.actionId === CSP_TEST_ACTION_ID)) {
    await clearTestState(siteId).catch(() => undefined);
  }
  let auditChangeSetId: string | undefined;
  let auditError: string | undefined;

  try {
    if (rolledBack.length > 0) {
      await db
        .update(wordpressActionRuns)
        .set({ status: 'rolled_back', completedAt: new Date() })
        .where(inArray(wordpressActionRuns.id, rolledBack.map((outcome) => outcome.runId)));
    }

    if (changeSetId && rolledBack.length === planned.length && notReversible.length === 0) {
      await db
        .update(changeSets)
        .set({ status: 'rolled_back', updatedAt: new Date() })
        .where(and(eq(changeSets.id, changeSetId), eq(changeSets.siteId, siteId)));
    }

    const [auditSet] = await db
      .insert(changeSets)
      .values({
        siteId,
        title: 'WordPress Rollback',
        description: `Undid ${rolledBack.length} of ${planned.length} WordPress action(s).`,
        status: rolledBack.length === planned.length ? 'applied' : 'failed',
        createdByUserId: dbUser.id,
      })
      .returning({ id: changeSets.id });
    auditChangeSetId = auditSet?.id;

    if (auditChangeSetId) {
      const runById = new Map(runs.map((run) => [run.id, run]));
      await db.insert(changeItems).values(
        outcomes.map((outcome) => ({
          changeSetId: auditChangeSetId!,
          op: 'rollback',
          path: `wordpress/${runById.get(outcome.runId)?.actionId ?? 'unknown'}`,
          oldValue: { status: 'applied', actionRunId: outcome.runId },
          newValue: { status: outcome.status, message: outcome.message },
        })),
      );
    }
  } catch (error) {
    auditError = error instanceof Error ? error.message : String(error);
    console.warn('[wordpress/rollback] audit persistence failed:', auditError);
  }

  publishEvent(siteId, {
    type: 'repair',
    state: 'repaired',
    message: `${rolledBack.length} WordPress change(s) undone.`,
    platform: 'wordpress',
  });

  return NextResponse.json({
    success: rolledBack.length === planned.length,
    siteId,
    rolledBack: rolledBack.length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
    notAttempted: planned.length - outcomes.length,
    notReversible,
    outcomes,
    auditChangeSetId,
    ...(auditError ? { auditError } : {}),
  });
}
