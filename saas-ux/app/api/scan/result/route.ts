// app/api/scan/result/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { scanJobs } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import { users } from '@/lib/db/schema/auth/users';
import { eq } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { kvGet, kvSet } from '@/lib/kv';
import { getDbUserFromClerk } from '@/lib/auth/current';
import { sendScanCompleteEmail, type ScanFinding } from '@/lib/email/send';
import type { ScanReport } from '@/lib/scan/types';
import { logger } from '@/lib/logger';

const log = logger('scan/result');

async function readReportBlob(key: string): Promise<{ report?: ScanReport } | null> {
  const { blobs } = await list({ prefix: key });
  const match = blobs.find((b) => b.pathname === key) || blobs[0];
  if (!match) return null;
  const r = await fetch(match.url, { cache: 'no-store' });
  return (await r.json().catch(() => null)) as { report?: ScanReport } | null;
}

/** Extract top N findings from the report's issues array. */
function extractFindings(
  report: ScanReport,
  max = 3
): { findings: ScanFinding[]; remaining: number } {
  const issues = report.issues ?? [];
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...issues].sort(
    (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
  );
  const top = sorted.slice(0, max).map((i) => ({
    severity: String(i.severity ?? 'medium'),
    title: String(i.title ?? i.id ?? ''),
    description: String(i.description ?? '').slice(0, 120),
  }));
  return { findings: top, remaining: Math.max(0, issues.length - max) };
}

export async function GET(req: NextRequest) {
  const db = getDb();

  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const [row] = await db
    .select({
      job: scanJobs,
      ownerId: sites.userId,
      siteUrl: sites.siteUrl,
    })
    .from(scanJobs)
    .innerJoin(sites, eq(sites.id, scanJobs.siteId))
    .where(eq(scanJobs.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });
  if (row.ownerId !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const job = row.job;
  const key = job.reportBlobKey || `scan-results/${id}.json`;

  try {
    const data = await readReportBlob(key);
    const report = data?.report;
    if (!report) {
      return NextResponse.json(
        { ok: false, notReady: true, error: 'report blob missing', key, status: job.status },
        { status: 202 }
      );
    }

    // ── Send scan complete email (once per job via KV dedup) ─────────────────
    const emailKey = `email:scan:${id}`;
    const alreadySent = await kvGet(emailKey);
    if (!alreadySent) {
      // Mark first — prevents double-send if this request races with another poll
      await kvSet(emailKey, '1', 60 * 60 * 24 * 7); // 7-day TTL

      const [userRow] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, row.ownerId))
        .limit(1);

      if (userRow) {
        const { findings, remaining } = extractFindings(report);
        // These used to be hardcoded to 0, so every recipient was told all four
        // of their category scores were zero. Read them off the report instead.
        const scores = report.summary?.categoryScores;
        sendScanCompleteEmail({
          to: userRow.email,
          firstName: (userRow.name ?? userRow.email).split(' ')[0],
          siteUrl: (() => {
            try {
              return new URL(row.siteUrl).hostname;
            } catch {
              return row.siteUrl;
            }
          })(),
          siteId: job.siteId,
          overallScore: report.summary?.score ?? 0,
          seoScore: scores?.seo ?? 0,
          perfScore: scores?.performance ?? 0,
          secScore: scores?.security ?? 0,
          a11yScore: scores?.accessibility ?? 0,
          topFindings: findings,
          remainingCount: remaining,
        }).catch((e) => log.error('scan complete email failed', e, { jobId: id }));
      }
    }

    return NextResponse.json({ ok: true, report, key });
  } catch (e) {
    log.error('result read failed', e, { jobId: id, key });
    return NextResponse.json(
      { ok: false, error: 'failed to read result', key },
      { status: 500 }
    );
  }
}
