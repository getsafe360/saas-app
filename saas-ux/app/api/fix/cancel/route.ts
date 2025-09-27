export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { findCurrentUserTeam } from '@/lib/auth/current';

export async function POST(req: NextRequest) {
  const db = getDb();

  let jobId: string | undefined;
  try {
    const body = await req.json();
    jobId = body?.jobId;
  } catch {}
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const ctx = await findCurrentUserTeam();
  if (!ctx?.team) return NextResponse.json({ error: 'not authorized' }, { status: 403 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  if (job.teamId !== ctx.team.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Nothing to deduct; just mark touched (optional)
  await db.update(fixJobs)
    .set({ updatedAt: new Date() /* optionally: status: 'cancelled' */ })
    .where(eq(fixJobs.id, jobId));

  return NextResponse.json({ ok: true });
}
