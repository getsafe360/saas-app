// app/api/fix/status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { publishEvent } from '@/lib/cockpit/event-bus';

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'fix_job_not_found' }, { status: 404 });

  if (job.status === 'done' || job.status === 'error') {
    publishEvent(job.siteId, { type: 'repair', state: 'repaired', message: 'Repairs completed successfully' });

  return NextResponse.json({
      ok: true,
      id: job.id,
      status: job.status,
      resultBlobKey: job.resultBlobKey ?? null,
      errorMessage: job.errorMessage ?? null
    });
  }

  // Simulated “apply” step: build a tiny result payload and store it
  const result = {
    applied: job.issues, // echo back the issues we "fixed"
    summary: {
      message: 'Fixes applied successfully (mock).',
      tokensCharged: job.estTokens
    }
  };

  const key = `fix-results/${job.id}.json`;
  await put(key, JSON.stringify(result, null, 2), {
    access: 'public',
    contentType: 'application/json'
  });

  publishEvent(job.siteId, { type: 'repair', state: 'repairing', message: 'Applying remediations' });

  await db.update(fixJobs)
    .set({ status: 'done', resultBlobKey: key, updatedAt: new Date(), agentUsed: 'fallback' })
    .where(eq(fixJobs.id, job.id));

  publishEvent(job.siteId, { type: 'repair', state: 'repaired', message: 'Repairs completed successfully' });

  return NextResponse.json({
    ok: true,
    id: job.id,
    status: 'done',
    resultBlobKey: key
  });
}
