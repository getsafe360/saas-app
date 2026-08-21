// app/api/scan/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// PageSpeed alone can take 25s; give the whole scan room to finish.
export const maxDuration = 60;

import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { list, put } from '@vercel/blob';
import { eq } from 'drizzle-orm';

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

type Body = { siteId?: string; categories?: ScanCategory[]; locale?: string };

function dbErr(e: unknown) {
  const any = e as any;
  return { message: any?.message ?? 'db error', code: any?.code, detail: any?.detail };
}

// Try to load site metadata from Blob and insert a DB row with userId
async function ensureSiteExistsForUser(
  db: ReturnType<typeof getDb>,
  siteId: string,
  userId: number
) {
  const existing = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (existing[0]) return existing[0];

  try {
    const { blobs } = await list({ prefix: `sites/${siteId}.json`, limit: 1 });
    const b = blobs[0];
    if (!b) return null;

    const r = await fetch(b.url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!j || !j.siteUrl) return null;

    await db.insert(sites).values({
      id: siteId,
      userId,
      siteUrl: j.siteUrl,
      status: (j.status ?? 'connected') as any,
      cms: (j.cms ?? 'wordpress') as any,
      wpVersion: j.wpVersion ?? null,
      pluginVersion: j.pluginVersion ?? null,
      createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
      updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
    });

    const [inserted] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    return inserted ?? null;
  } catch (e) {
    log.error('blob → db site hydration failed', e, { siteId });
    return null;
  }
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

    if (report.summary.prose) {
      await db
        .update(sites)
        .set({ lastSummary: report.summary.prose })
        .where(eq(sites.id, siteId));
    }

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
    : ['seo', 'performance', 'accessibility', 'security'];
  const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 8) : 'en';

  // 4) Make sure the site row exists and is owned by this user
  let site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site[0]) {
    const inserted = await ensureSiteExistsForUser(db, siteId, user.id);
    if (!inserted) {
      return NextResponse.json(
        {
          error: 'site not found; connect it first',
          hint: 'Run WP plugin handshake or add the site in Dashboard.',
        },
        { status: 404 }
      );
    }
    site = [inserted];
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
