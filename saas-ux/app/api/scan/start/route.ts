// app/api/scan/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// PageSpeed alone can take 25s; give the whole scan room to finish.
export const maxDuration = 60;

import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema/sites';
import { scanJobs } from '@/lib/db/schema';
import { getDbUserFromClerk } from '@/lib/auth/current';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { rateLimit, tooManyRequests } from '@/lib/api/rate-limit';
import { runScan, ScanError } from '@/lib/scan/runner';
import type { ScanCategory } from '@/lib/scan/types';
import { logger } from '@/lib/logger';

const log = logger('scan/start');

const ALL_CATEGORIES: ScanCategory[] = ['seo', 'performance', 'accessibility', 'security'];

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** The three issues worth doing first: most severe, auto-fixable ones ahead of advice-only. */
function topIssues(issues: Array<{ id: string; title: string; severity: string; category: string; fixAvailable?: boolean }>) {
  return [...issues]
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
        Number(!!b.fixAvailable) - Number(!!a.fixAvailable),
    )
    .slice(0, 3)
    .map((i) => ({
      id: i.id,
      title: String(i.title).slice(0, 140),
      severity: i.severity,
      category: i.category,
      fixAvailable: !!i.fixAvailable,
    }));
}

type Body = { siteId?: string; categories?: ScanCategory[]; locale?: string };

function dbErr(e: unknown) {
  const any = e as any;
  return { message: any?.message ?? 'db error', code: any?.code, detail: any?.detail };
}

/**
 * Run the scan and record the outcome.
 *
 * Called from `after()` so the client gets its jobId immediately and polls
 * /api/scan/status for progress — the status route no longer performs work.
 */
async function executeScan(params: {
  jobId: string;
  siteId: string;
  siteUrl: string;
  categories: ScanCategory[];
  locale: string;
}) {
  const db = getDb();
  const { jobId, siteId, siteUrl, categories, locale } = params;

  try {
    await db
      .update(scanJobs)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(scanJobs.id, jobId));

    publishEvent(siteId, { type: 'progress', state: 'in_progress', progress: 25 });

    const report = await runScan({ siteUrl, categories, locale });

    const key = `scan-results/${jobId}.json`;
    await put(key, JSON.stringify({ report }, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    publishEvent(siteId, { type: 'progress', state: 'in_progress', progress: 85 });
    for (const category of Object.keys(report.summary.counts)) {
      publishEvent(siteId, {
        type: 'category',
        state: 'in_progress',
        category,
        issues: report.issues.filter((issue) => issue.category === category),
      });
    }

    await db
      .update(scanJobs)
      .set({
        status: 'done',
        agentUsed: 'internal',
        reportBlobKey: key,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId));

    // Snapshot for the cockpit: the latest job, how many findings, and the scan's own
    // scores under their own key so they never overwrite the quick-analysis numbers.
    const scannedAll = ALL_CATEGORIES.every((category) => categories.includes(category));
    const scanSnapshot = {
      scan: {
        jobId,
        at: new Date().toISOString(),
        // Categories outside the request get a perfect score from an empty issue list, so
        // only the scanned ones are stored, and the overall only for a full scan.
        ...(scannedAll ? { overall: report.summary.score } : {}),
        categoryScores: Object.fromEntries(
          Object.entries(report.summary.categoryScores).filter(([key]) => categories.includes(key as ScanCategory)),
        ),
        top: topIssues(report.issues),
        issueCount: report.issues.length,
        fixableCount: report.issues.filter((issue) => issue.fixAvailable).length,
      },
    };
    await db
      .update(sites)
      .set({
        lastScanJobId: jobId,
        lastFindingCount: report.issues.length,
        lastScores: sql`coalesce(${sites.lastScores}, '{}'::jsonb) || ${JSON.stringify(scanSnapshot)}::jsonb`,
        ...(report.summary.prose ? { lastSummary: report.summary.prose } : {}),
      })
      .where(eq(sites.id, siteId));

    publishEvent(siteId, { type: 'status', state: 'completed' });
  } catch (err) {
    const message =
      err instanceof ScanError
        ? err.message
        : 'The scan could not be completed. Please try again.';

    log.error('scan execution failed', err, { jobId, siteId, siteUrl });

    await db
      .update(scanJobs)
      .set({
        status: 'error',
        errorMessage: message,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId))
      .catch((e) => log.error('could not record scan failure', e, { jobId }));

    publishEvent(siteId, { type: 'status', state: 'errors_found' });
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();

  // 1) Auth (server-side Clerk)
  const user = await getDbUserFromClerk();
  if (!user) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  // 2) Rate limit per user — a scan costs us a PageSpeed quota unit and a
  //    model call, so this is an abuse and cost control, not just hygiene.
  const rl = await rateLimit(`scan-start:${user.id}`, 10, 10 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl);

  // 3) Body
  const body = (await req.json().catch(() => null)) as Body | null;
  const siteId = body?.siteId?.trim();
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }
  const cats: ScanCategory[] = body?.categories?.length
    ? body.categories
    : ALL_CATEGORIES;
  const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 8) : 'en';

  // 4) Make sure the site row exists and is owned by this user
  // The database is the only source of sites. (A removed fallback recreated
  // missing rows from public blobs and assigned them to whoever asked.)
  const site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site[0]) {
    return NextResponse.json(
      {
        error: 'site not found; connect it first',
        hint: 'Run WP plugin handshake or add the site in Dashboard.',
      },
      { status: 404 }
    );
  } else if (site[0].userId !== user.id) {
    return NextResponse.json(
      { error: 'forbidden: site belongs to another user' },
      { status: 403 }
    );
  }

  const siteUrl = site[0]!.siteUrl;

  // 5) Enqueue scan job (with FK satisfied)
  const jobId = crypto.randomUUID();
  try {
    await db.insert(scanJobs).values({
      id: jobId,
      siteId,
      status: 'queued',
      categories: cats.join(','),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (e) {
    log.error('enqueue failed', e, { siteId });
    return NextResponse.json({ error: 'failed to enqueue', detail: dbErr(e) }, { status: 500 });
  }

  publishEvent(siteId, { type: 'status', state: 'in_progress' });
  publishEvent(siteId, { type: 'progress', state: 'in_progress', progress: 10 });

  // 6) Run the scan after the response is sent.
  after(() => executeScan({ jobId, siteId, siteUrl, categories: cats, locale }));

  return NextResponse.json({ jobId, queued: true });
}
