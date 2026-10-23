// app/api/scan/status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { scanJobs } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import { eq } from 'drizzle-orm';
import { getDbUserFromClerk } from '@/lib/auth/current';
import { publishEvent } from '@/lib/cockpit/event-bus';

// This route used to *perform* the scan on every GET — generating a hardcoded
// sample report, writing it to Blob and flipping the job to done. It is now
// strictly read-only; /api/scan/start owns execution. A GET must never mutate
// state or spend money.

/** How long a job may sit in queued/running before we call it stalled. */
const STALE_AFTER_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const db = getDb();

  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const [row] = await db
    .select({ job: scanJobs, ownerId: sites.userId })
    .from(scanJobs)
    .innerJoin(sites, eq(sites.id, scanJobs.siteId))
    .where(eq(scanJobs.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });
  if (row.ownerId !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const job = row.job;

  // If the worker died mid-scan the row would sit in `running` forever and the
  // client would poll indefinitely. Surface it as an error instead. The cron
  // in /api/jobs/cleanup does the same thing for jobs nobody is polling.
  const age = Date.now() - new Date(job.updatedAt).getTime();
  if ((job.status === 'queued' || job.status === 'running') && age > STALE_AFTER_MS) {
    await db
      .update(scanJobs)
      .set({
        status: 'error',
        errorMessage: 'The scan timed out. Please try again.',
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scanJobs.id, job.id));

    publishEvent(job.siteId, { type: 'status', state: 'errors_found' });

    return NextResponse.json({
      ok: true,
      id: job.id,
      status: 'error',
      errorMessage: 'The scan timed out. Please try again.',
    });
  }

  if (job.status === 'done') {
    publishEvent(job.siteId, { type: 'status', state: 'completed' });
  }

  return NextResponse.json({
    ok: true,
    id: job.id,
    status: job.status,
    agentUsed: job.agentUsed ?? null,
    reportBlobKey: job.reportBlobKey ?? null,
    errorMessage: job.errorMessage ?? null,
    updatedAt: job.updatedAt,
  });
}
