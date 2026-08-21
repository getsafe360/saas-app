// app/api/fix/accept/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { list, put } from '@vercel/blob';

import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { teams } from '@/lib/db/schema/auth';
import { sites } from '@/lib/db/schema/sites';
import { users } from '@/lib/db/schema/auth/users';
import { tokenTransactions } from '@/lib/db/schema/billing/token-transactions';
import { findCurrentUserTeam, getDbUserFromClerk } from '@/lib/auth/current';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { executeFixProposal } from '@/lib/fix/execute';
import type { FixProposal, FixResult } from '@/lib/fix/types';
import { sendFixCompleteEmail } from '@/lib/email/send';
import { logger } from '@/lib/logger';

const log = logger('fix/accept');

async function readProposal(key: string): Promise<FixProposal | null> {
  const { blobs } = await list({ prefix: key });
  const match = blobs.find((b) => b.pathname === key) || blobs[0];
  if (!match) return null;
  const r = await fetch(match.url, { cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as { proposal?: FixProposal } | null;
  return j?.proposal ?? null;
}

/**
 * The approval gate. This is the only place that changes a customer's
 * WordPress site, and the only place that spends tokens.
 *
 * Tokens are deducted after a successful apply, never before, and never when
 * the site rejects the change.
 */
export async function POST(req: NextRequest) {
  const db = getDb();

  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });

  let jobId: string | undefined;
  try {
    jobId = (await req.json())?.jobId;
  } catch {
    /* handled below */
  }
  if (!jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });

  const team = await findCurrentUserTeam();
  if (!team?.id) return NextResponse.json({ ok: false, error: 'not authorized' }, { status: 403 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });
  if (job.teamId !== team.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (job.approvalState !== 'pending') {
    return NextResponse.json(
      { ok: false, error: 'already_resolved', approvalState: job.approvalState },
      { status: 409 }
    );
  }

  const [site] = await db.select().from(sites).where(eq(sites.id, job.siteId)).limit(1);
  if (!site?.tokenHash) {
    return NextResponse.json(
      { ok: false, error: 'not_connected', message: 'This site is no longer connected.' },
      { status: 409 }
    );
  }

  const proposal = job.proposalBlobKey ? await readProposal(job.proposalBlobKey) : null;
  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: 'proposal_missing', message: 'This proposal has expired. Please run the fix again.' },
      { status: 410 }
    );
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  await db
    .update(fixJobs)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(fixJobs.id, jobId));

  const results = await executeFixProposal({
    proposal,
    siteUrl: site.siteUrl,
    tokenHash: site.tokenHash,
  });

  const applied = results.filter((r) => r.status === 'applied');
  const failed = results.filter((r) => r.status !== 'applied');

  const result: FixResult = {
    jobId,
    siteUrl: site.siteUrl,
    appliedAt: new Date().toISOString(),
    results,
    appliedCount: applied.length,
    failedCount: failed.length,
  };

  const resultKey = `fix-results/${jobId}.json`;
  await put(resultKey, JSON.stringify(result, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  }).catch((e) => log.error('could not store fix result', e, { jobId }));

  // ── Nothing applied: release the hold, charge nothing ─────────────────────
  if (applied.length === 0) {
    await db
      .update(fixJobs)
      .set({
        status: 'error',
        approvalState: 'failed',
        holdTokens: 0,
        resultBlobKey: resultKey,
        errorMessage: failed[0]?.message ?? 'The site did not accept any of the changes.',
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId));

    publishEvent(job.siteId, {
      type: 'repair',
      state: 'errors_found',
      message: 'No changes could be applied. You were not charged.',
    });

    log.warn('no operations applied, hold released', { jobId, siteId: job.siteId });

    return NextResponse.json(
      {
        ok: false,
        error: 'apply_failed',
        message: 'We could not apply any of the changes, so nothing was charged.',
        results,
      },
      { status: 502 }
    );
  }

  // ── Charge only for what actually landed ──────────────────────────────────
  const appliedIds = new Set(applied.map((r) => r.issueId));
  const chargeable = (job.issues ?? [])
    .filter((i) => appliedIds.has(i.id))
    .reduce((sum, i) => sum + (i.estTokens || 0), 0);
  const charge = Math.min(chargeable, job.holdTokens);

  let remainingTokens = 0;

  const charged = await db.transaction(async (tx) => {
    if (charge <= 0) {
      const [row] = await tx
        .select({ tokensRemaining: teams.tokensRemaining })
        .from(teams)
        .where(eq(teams.id, team.id))
        .limit(1);
      return row?.tokensRemaining ?? 0;
    }

    const updated = await tx
      .update(teams)
      .set({
        tokensRemaining: sql`${teams.tokensRemaining} - ${charge}`,
        tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${charge}`,
      })
      .where(and(eq(teams.id, team.id), sql`${teams.tokensRemaining} >= ${charge}`))
      .returning({ tokensRemaining: teams.tokensRemaining });

    if (updated.length === 0) return null;

    await tx.insert(tokenTransactions).values({
      teamId: team.id,
      amountTokens: -charge,
      type: 'burn',
    });

    return updated[0]!.tokensRemaining;
  });

  if (charged === null) {
    // Balance moved underneath us. The change is already live on the site, so
    // record it and let it through rather than leaving the job in limbo —
    // under-charging is the safe direction to fail.
    log.error('balance insufficient at charge time; releasing hold', undefined, {
      jobId,
      teamId: team.id,
      charge,
    });
    await db
      .update(fixJobs)
      .set({
        status: 'done',
        approvalState: 'applied',
        holdTokens: 0,
        resultBlobKey: resultKey,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId));
    remainingTokens = 0;
  } else {
    remainingTokens = charged;
    await db
      .update(fixJobs)
      .set({
        status: 'done',
        approvalState: 'applied',
        holdTokens: 0,
        // estTokens now records what was actually charged, not what we quoted.
        estTokens: charge,
        resultBlobKey: resultKey,
        errorMessage: failed.length > 0 ? `${failed.length} change(s) could not be applied.` : null,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fixJobs.id, jobId));
  }

  publishEvent(job.siteId, {
    type: 'repair',
    state: 'repaired',
    message: `Applied ${applied.length} change${applied.length === 1 ? '' : 's'}`,
  });

  // Notification is best-effort — never fail the request over an email.
  void (async () => {
    try {
      const [userRow] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, site.userId))
        .limit(1);
      if (!userRow) return;
      await sendFixCompleteEmail({
        to: userRow.email,
        firstName: (userRow.name ?? userRow.email).split(' ')[0],
        siteUrl: new URL(site.siteUrl).hostname,
        siteId: job.siteId,
        fixTitle: applied[0]!.title,
        fixCategory: applied.length > 1 ? `${applied.length} changes` : 'Website fix',
        fixImpact: failed.length > 0 ? 'Partially applied' : 'Applied',
        fixDescription: applied.map((r) => r.title).join(', '),
        tokensUsed: charge,
        tokensRemaining: remainingTokens,
      });
    } catch (e) {
      log.error('fix complete email failed', e, { jobId });
    }
  })();

  log.info('fix applied', {
    jobId,
    siteId: job.siteId,
    applied: applied.length,
    failed: failed.length,
    charge,
  });

  return NextResponse.json({
    ok: true,
    remainingTokens,
    tokensCharged: charge,
    results,
    partial: failed.length > 0,
  });
}
