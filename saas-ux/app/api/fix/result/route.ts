// app/api/fix/result/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { list } from '@vercel/blob';

import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { findCurrentUserTeam, getDbUserFromClerk } from '@/lib/auth/current';
import { logger } from '@/lib/logger';

const log = logger('fix/result');

// The fix-complete email is sent from /api/fix/accept, which is the only place
// that knows what was actually applied and what was charged. It used to be
// sent from here on first read, which meant a job that failed still produced a
// "your fix is complete" email as soon as anyone polled the result.

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

  const key = job.resultBlobKey || `fix-results/${id}.json`;

  try {
    const { blobs } = await list({ prefix: key });
    const match = blobs.find((b) => b.pathname === key) || blobs[0];
    if (!match) return NextResponse.json({ ok: false, error: 'not_ready' }, { status: 202 });

    const r = await fetch(match.url, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j) return NextResponse.json({ ok: false, error: 'read_error' }, { status: 500 });

    return NextResponse.json({ ok: true, result: j, approvalState: job.approvalState });
  } catch (e) {
    log.error('result read failed', e, { jobId: id, key });
    return NextResponse.json({ ok: false, error: 'read_error' }, { status: 500 });
  }
}
