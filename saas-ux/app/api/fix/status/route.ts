// app/api/fix/status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { findCurrentUserTeam, getDbUserFromClerk } from '@/lib/auth/current';

// Previously this GET *performed* the fix: it wrote a blob saying "Fixes
// applied successfully (mock)." and flipped the job to done, while
// /api/fix/start had already deducted real tokens. It is now read-only.
// /api/fix/accept owns execution and charging.

export async function GET(req: NextRequest) {
  const db = getDb();

  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 });

  const team = await findCurrentUserTeam();
  if (!team?.id) return NextResponse.json({ ok: false, error: 'not authorized' }, { status: 403 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'fix_job_not_found' }, { status: 404 });
  if (job.teamId !== team.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    id: job.id,
    status: job.status,
    approvalState: job.approvalState,
    /** True while the job is waiting for the user to click Apply. */
    requiresApproval: job.approvalState === 'pending',
    estTokens: job.estTokens,
    holdTokens: job.holdTokens,
    resultBlobKey: job.resultBlobKey ?? null,
    errorMessage: job.errorMessage ?? null,
    updatedAt: job.updatedAt,
  });
}
