// app/api/fix/cancel/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { findCurrentUserTeam, getDbUserFromClerk } from '@/lib/auth/current';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { getAvailableTokens } from '@/lib/fix/tokens';
import { logger } from '@/lib/logger';

const log = logger('fix/cancel');

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

  // Already applied? Cancelling cannot un-charge a change that is live.
  if (job.approvalState === 'applied') {
    return NextResponse.json(
      { ok: false, error: 'already_applied', message: 'This fix has already been applied.' },
      { status: 409 }
    );
  }

  // Declining releases the hold. Nothing was ever deducted, so there is
  // nothing to refund — which is the whole point of the escrow model.
  await db
    .update(fixJobs)
    .set({
      status: 'cancelled',
      approvalState: 'cancelled',
      holdTokens: 0,
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fixJobs.id, jobId));

  publishEvent(job.siteId, {
    type: 'repair',
    state: 'idle',
    message: 'Fix declined. No tokens were used.',
  });

  log.info('fix declined', { jobId, releasedTokens: job.holdTokens });

  const { available } = await getAvailableTokens(team.id);
  return NextResponse.json({ ok: true, availableTokens: available });
}
