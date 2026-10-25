// app/api/fix/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { list, put } from '@vercel/blob';

import { getDb } from '@/lib/db/drizzle';
import { fixJobs, scanJobs } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import { findCurrentUserTeam, getDbUserFromClerk } from '@/lib/auth/current';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { rateLimit, tooManyRequests } from '@/lib/api/rate-limit';
import { planFixes } from '@/lib/fix/planner';
import { getAvailableTokens } from '@/lib/fix/tokens';
import type { ScanReport } from '@/lib/scan/types';
import { logger } from '@/lib/logger';

/** Namespace for the per-team advisory lock that serialises token reservation. */
const FIX_RESERVE_LOCK = 4207;

const log = logger('fix/start');

type StartBody = { siteId?: string; issueIds?: string[]; locale?: string };

async function readLatestReportForSite(siteId: string): Promise<ScanReport | null> {
  const db = getDb();

  const [job] = await db
    .select()
    .from(scanJobs)
    .where(and(eq(scanJobs.siteId, siteId), eq(scanJobs.status, 'done')))
    .orderBy(desc(scanJobs.updatedAt))
    .limit(1);

  if (!job) return null;

  const key = job.reportBlobKey || `scan-results/${job.id}.json`;
  const { blobs } = await list({ prefix: key });
  const match = blobs.find((b) => b.pathname === key) || blobs[0];
  if (!match) return null;

  const r = await fetch(match.url, { cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as { report?: ScanReport } | null;
  return j?.report ?? null;
}

/**
 * Prepare a fix. This does NOT change the customer's site and does NOT spend
 * tokens — it produces a proposal the user must explicitly approve at
 * /api/fix/accept. The previous implementation deducted tokens here and then
 * deducted them a second time on accept, while writing a mock result that
 * claimed success without touching WordPress.
 */
export async function POST(req: NextRequest) {
  const db = getDb();

  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });

  const rl = await rateLimit(`fix-start:${user.id}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const siteId = body?.siteId;
  const issueIds = Array.isArray(body?.issueIds) ? body.issueIds.filter(Boolean) : [];
  if (!siteId || issueIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'siteId_and_issueIds_required' },
      { status: 400 }
    );
  }

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return NextResponse.json({ ok: false, error: 'site_not_found' }, { status: 404 });
  if (site.userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const team = await findCurrentUserTeam();
  if (!team?.id) return NextResponse.json({ ok: false, error: 'no_team' }, { status: 403 });

  // A fix can only be applied to a site whose connector is paired — otherwise
  // there is nothing to push to and we would be selling a no-op.
  if (!site.tokenHash) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_connected',
        message:
          'Connect the GetSafe 360 plugin to this WordPress site before applying fixes.',
      },
      { status: 409 }
    );
  }

  const report = await readLatestReportForSite(siteId);
  if (!report) {
    return NextResponse.json({ ok: false, error: 'no_recent_scan' }, { status: 409 });
  }

  let proposal;
  try {
    proposal = await planFixes({
      siteId,
      siteUrl: site.siteUrl,
      report,
      issueIds,
      locale: typeof body.locale === 'string' ? body.locale.slice(0, 8) : 'en',
    });
  } catch (err) {
    log.error('planning failed', err, { siteId, issueIds });
    return NextResponse.json(
      { ok: false, error: 'planning_failed', message: 'We could not prepare this fix. Please try again.' },
      { status: 502 }
    );
  }

  if (proposal.operations.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_fixable',
        message: 'None of the selected findings can be fixed automatically yet.',
        rejected: proposal.rejected,
      },
      { status: 422 }
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'staff';
  const { available } = await getAvailableTokens(team.id);
  if (!isAdmin && available < proposal.estTokens) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_tokens', have: available, need: proposal.estTokens },
      { status: 422 }
    );
  }

  const fixJobId = crypto.randomUUID();
  const proposalKey = `fix-proposals/${fixJobId}.json`;

  await put(proposalKey, JSON.stringify({ proposal }, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });

  // The check above is only a fast path. Two requests from one team can both pass it, so the
  // authoritative balance check and the hold insert run together inside a transaction that is
  // serialised per team (advisory lock): proposals can never reserve more than the balance.
  const reserved = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIX_RESERVE_LOCK}::int, ${team.id}::int)`);
    const fresh = await getAvailableTokens(team.id);
    if (!isAdmin && fresh.available < proposal.estTokens) {
      return { ok: false as const, available: fresh.available };
    }
  await tx.insert(fixJobs).values({
    id: fixJobId,
    teamId: team.id,
    siteId,
    // 'done' here means "the proposal is ready" — the UI shows Apply/Cancel.
    // approvalState carries the part that matters for billing.
    status: 'done',
    approvalState: 'pending',
    issues: proposal.operations.map((o) => ({
      id: o.issueId,
      estTokens: report.issues.find((i) => i.id === o.issueId)?.estTokens ?? 0,
    })),
    estTokens: proposal.estTokens,
    holdTokens: isAdmin ? 0 : proposal.estTokens,
    proposalBlobKey: proposalKey,
    agentUsed: 'internal',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
    return { ok: true as const };
  });

  if (!reserved.ok) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_tokens', have: reserved.available, need: proposal.estTokens },
      { status: 422 }
    );
  }

  publishEvent(siteId, {
    type: 'repair',
    state: 'repairing',
    message: `Prepared ${proposal.operations.length} change${proposal.operations.length === 1 ? '' : 's'} for your approval`,
  });

  log.info('proposal ready', {
    fixJobId,
    siteId,
    operations: proposal.operations.length,
    estTokens: proposal.estTokens,
  });

  return NextResponse.json({
    ok: true,
    fixJobId,
    estTokens: proposal.estTokens,
    requiresApproval: true,
    operations: proposal.operations,
    rejected: proposal.rejected,
  });
}
