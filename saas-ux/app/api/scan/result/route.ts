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
import { sendScanCompleteEmail, type ScanFinding } from '@/lib/email/send';

const DEV = process.env.NODE_ENV !== 'production';

async function readReportBlob(key: string): Promise<any | null> {
  const { blobs } = await list({ prefix: key });
  const match = blobs.find(b => b.pathname === key) || blobs[0];
  if (!match) return null;
  const r = await fetch(match.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  return j;
}

/** Extract top N findings from the report's issues array. */
function extractFindings(report: any, max = 3): { findings: ScanFinding[]; remaining: number } {
  const issues: any[] = report?.issues ?? [];
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...issues].sort(
    (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9),
  );
  const top = sorted.slice(0, max).map((i) => ({
    severity: String(i.severity ?? 'medium'),
    title: String(i.title ?? i.id ?? ''),
    description: String(i.description ?? i.detail ?? '').slice(0, 120),
  }));
  return { findings: top, remaining: Math.max(0, issues.length - max) };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const [job] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });

  const key = job.reportBlobKey || `scan-results/${id}.json`;

  try {
    const data = await readReportBlob(key);
    if (!data?.report) {
      return NextResponse.json(
        { ok: false, notReady: true, error: 'report blob missing', key, status: job.status },
        { status: 202 },
      );
    }

    // ── Send scan complete email (once per job via KV dedup) ─────────────────
    const emailKey = `email:scan:${id}`;
    const alreadySent = await kvGet(emailKey);
    if (!alreadySent) {
      // Mark first — prevents double-send if this request races with another poll
      await kvSet(emailKey, '1', 60 * 60 * 24 * 7); // 7-day TTL
      const report = data.report;
      // Join site → user to get recipient
      const [siteRow] = await db
        .select({ siteUrl: sites.siteUrl, userId: sites.userId })
        .from(sites)
        .where(eq(sites.id, job.siteId))
        .limit(1);
      if (siteRow) {
        const [userRow] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, siteRow.userId))
          .limit(1);
        if (userRow) {
          const { findings, remaining } = extractFindings(report);
          const scores = report.scores ?? {};
          sendScanCompleteEmail({
            to: userRow.email,
            firstName: (userRow.name ?? userRow.email).split(' ')[0],
            siteUrl: new URL(siteRow.siteUrl).hostname,
            siteId: job.siteId,
            overallScore: scores.overall ?? 0,
            seoScore: scores.seo ?? 0,
            perfScore: scores.performance ?? 0,
            secScore: scores.security ?? 0,
            a11yScore: scores.accessibility ?? 0,
            topFindings: findings,
            remainingCount: remaining,
          }).catch((e) => console.error('[scan/result] email failed', e));
        }
      }
    }

    return NextResponse.json({ ok: true, report: data.report, key });
  } catch (e: any) {
    if (DEV) console.error('[scan/result] read error', e);
    return NextResponse.json(
      { ok: false, error: 'failed to read result', message: String(e?.message ?? e), key },
      { status: 500 },
    );
  }
}
