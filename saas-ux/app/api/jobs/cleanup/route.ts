// app/api/jobs/cleanup/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, lt } from 'drizzle-orm';

import { getDb } from '@/lib/db/drizzle';
import { fixJobs, scanJobs } from '@/lib/db/schema';
import { isAdminRequest } from '@/lib/server/isAdminRequest';
import { logger } from '@/lib/logger';

const log = logger('jobs/cleanup');

/**
 * Sweeps jobs that were left mid-flight — a serverless function that ran out
 * of time, a deploy in the middle of a scan, a WordPress site that stopped
 * answering. Without this they sit in `queued`/`running` forever, the UI polls
 * indefinitely, and held tokens are never released.
 *
 * Wired to a Vercel Cron entry (see vercel.json) that runs once a day at 04:00 UTC,
 * the most the Hobby plan allows. On a Pro plan, change the schedule to "*/10 * * * *" so
 * stuck jobs and their token holds are released within minutes instead of hours.
 * Authorised either by CRON_SECRET (Vercel sends it as a Bearer token) or by
 * an admin session, so it can also be triggered by hand during an incident.
 */

const SCAN_TIMEOUT_MS = 10 * 60 * 1000;
const FIX_TIMEOUT_MS = 10 * 60 * 1000;
/** Proposals nobody approved. Released so the capacity comes back. */
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get('authorization');
    if (header === `Bearer ${secret}`) return true;
  }
  return isAdminRequest();
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const db = getDb();
  const now = Date.now();

  const staleScans = await db
    .update(scanJobs)
    .set({
      status: 'error',
      errorMessage: 'The scan timed out and was closed automatically.',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(scanJobs.status, ['queued', 'running']),
        lt(scanJobs.updatedAt, new Date(now - SCAN_TIMEOUT_MS))
      )
    )
    .returning({ id: scanJobs.id });

  // A fix stuck in `running` never reached the charging step, so releasing the
  // hold costs the customer nothing and is always the safe direction.
  const staleFixes = await db
    .update(fixJobs)
    .set({
      status: 'error',
      approvalState: 'failed',
      holdTokens: 0,
      errorMessage: 'The fix timed out and was closed automatically. You were not charged.',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fixJobs.status, 'running'),
        lt(fixJobs.updatedAt, new Date(now - FIX_TIMEOUT_MS))
      )
    )
    .returning({ id: fixJobs.id });

  const expiredProposals = await db
    .update(fixJobs)
    .set({
      status: 'cancelled',
      approvalState: 'cancelled',
      holdTokens: 0,
      errorMessage: 'This proposal expired before it was approved.',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fixJobs.approvalState, 'pending'),
        lt(fixJobs.createdAt, new Date(now - PROPOSAL_TTL_MS))
      )
    )
    .returning({ id: fixJobs.id });

  const summary = {
    staleScans: staleScans.length,
    staleFixes: staleFixes.length,
    expiredProposals: expiredProposals.length,
  };

  if (summary.staleScans || summary.staleFixes || summary.expiredProposals) {
    log.info('cleanup swept jobs', summary);
  }

  return NextResponse.json({ ok: true, ...summary });
}
