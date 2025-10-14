// app/api/scans/save-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { scanSummaries, scanJobs } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json() as {
    jobId: string;
    siteId: string;
    scores?: Record<string, number>;
    screenshotUrl?: string;
    faviconUrl?: string;
    cms?: string | null;
    findings?: any[]; // keep this small (top N)
  };

  // 1) mark job as done if you manage lifecycle here
  await db.update(scanJobs)
    .set({ status: 'done', endedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(scanJobs.id, body.jobId), eq(scanJobs.siteId, body.siteId)));

  // 2) upsert summary (idempotent: job_id is PK)
  await db.insert(scanSummaries).values({
    jobId: body.jobId,
    siteId: body.siteId,
    scores: body.scores as any,
    screenshotUrl: body.screenshotUrl ?? null,
    faviconUrl: body.faviconUrl ?? null,
    cms: body.cms ?? null,
    findings: body.findings ? (body.findings as any[]) : null,
  }).onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
