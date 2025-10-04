// app/api/fix/cancel/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { findCurrentUserTeam } from '@/lib/auth/current';

export async function POST(req: NextRequest) {
  const db = getDb();

  // Parse body
  let jobId: string | undefined;
  try {
    const body = await req.json();
    jobId = body?.jobId;
  } catch {}
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  // Auth / team
  const team = await findCurrentUserTeam();
  if (!team) {
    return NextResponse.json({ error: 'not authorized' }, { status: 403 });
  }

  // Load job and authorize
  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  if (job.teamId !== team.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Mark touched (optionally set status: 'cancelled' if you add that enum)
  await db
    .update(fixJobs)
    .set({ updatedAt: new Date() })
    .where(eq(fixJobs.id, jobId));

  return NextResponse.json({ ok: true });
}
