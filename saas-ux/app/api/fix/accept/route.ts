export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs, teams } from '@/lib/db/schema';
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

  // Load job
  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, jobId)).limit(1);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  if (job.teamId !== ctx.team.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (job.status !== 'done') return NextResponse.json({ error: 'job not done' }, { status: 409 });

  // Deduct tokens atomically
  const updated = await db.transaction(async (tx) => {
    const updatedTeams = await tx.update(teams)
      .set({ tokensRemaining: sql`${teams.tokensRemaining} - ${job.estTokens}` })
      .where(and(
        eq(teams.id, ctx.team!.id),
        sql`${teams.tokensRemaining} >= ${job.estTokens}`
      ))
      .returning({ tokensRemaining: teams.tokensRemaining });

    if (updatedTeams.length === 0) {
      tx.rollback();
      return null;
    }

    await tx.update(fixJobs)
      .set({ updatedAt: new Date() /* optionally: status: 'accepted' */ })
      .where(eq(fixJobs.id, jobId));

    return updatedTeams[0];
  });

  if (!updated) {
    return NextResponse.json({ error: 'insufficient tokens' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, remainingTokens: updated.tokensRemaining });
}
