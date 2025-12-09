// app/api/scan/status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { scanJobs } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import { eq } from 'drizzle-orm';
import { list, put, type ListBlobResultBlob } from '@vercel/blob';

const DEV = process.env.NODE_ENV !== 'production';

async function getSiteUrl(db: ReturnType<typeof getDb>, siteId: string): Promise<string | null> {
  try {
    const [row] = await db.select({ siteUrl: sites.siteUrl }).from(sites).where(eq(sites.id, siteId)).limit(1);
    if (row?.siteUrl) return row.siteUrl;
  } catch {}
  try {
    const { blobs } = await list({ prefix: `sites/${siteId}.json` });
    const b = blobs?.[0] as ListBlobResultBlob | undefined;
    if (!b) return null;
    const r = await fetch(b.url, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    return j?.siteUrl ?? null;
  } catch {}
  return null;
}

function makeSampleReport(siteUrl: string) {
  return {
    siteUrl,
    summary: {
      score: 87,
      counts: { seo: 3, performance: 2, accessibility: 4, security: 1 },
      estTotalTokens: 12450
    },
    issues: [
      {
        id: 'seo-meta-desc',
        category: 'seo',
        title: 'Missing or short meta description',
        severity: 'medium',
        description: 'Some pages are missing a meta description or it’s too short.',
        suggestion: 'Add a descriptive meta description (120–160 chars).',
        fixAvailable: true,
        estTokens: 700
      },
      {
        id: 'perf-images',
        category: 'performance',
        title: 'Unoptimized images',
        severity: 'high',
        description: 'Large images increase load time.',
        suggestion: 'Serve responsive images and compress assets.',
        fixAvailable: true,
        estTokens: 2200
      },
      {
        id: 'a11y-contrast',
        category: 'accessibility',
        title: 'Insufficient color contrast',
        severity: 'high',
        description: 'Text and background colors fail WCAG contrast ratios.',
        suggestion: 'Adjust colors to meet WCAG AA contrast.',
        fixAvailable: false,
        estTokens: 1800
      }
    ],
    pagesAnalyzed: [siteUrl, `${siteUrl}/about`, `${siteUrl}/contact`]
  };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  // Load job
  const [job] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });

  // If already done, just echo status
  if (job.status === 'done') {
    return NextResponse.json({
      ok: true,
      id: job.id,
      status: job.status,
      agentUsed: job.agentUsed ?? 'fallback',
      reportBlobKey: job.reportBlobKey ?? null
    });
  }

  // Simulate/perform scan when queued/running
  try {
    const siteUrl = await getSiteUrl(db, job.siteId);
    if (!siteUrl) {
      return NextResponse.json({ ok: false, error: 'site url missing for job' }, { status: 409 });
    }

    // Produce a report (replace with your real analyzer if/when available)
    const report = makeSampleReport(siteUrl);
    const key = `scan-results/${job.id}.json`;
    await put(key, JSON.stringify({ report }, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });

    // Update job → done
    await db
      .update(scanJobs)
      .set({
        status: 'done',
        agentUsed: job.agentUsed ?? 'fallback',
        reportBlobKey: key,
        updatedAt: new Date()
      })
      .where(eq(scanJobs.id, job.id));

    return NextResponse.json({
      ok: true,
      id: job.id,
      status: 'done',
      agentUsed: 'fallback',
      reportBlobKey: key
    });
  } catch (e: any) {
    if (DEV) console.error('[scan/status] job run failed', e);
    return NextResponse.json({ ok: false, error: 'scan run failed', message: String(e?.message ?? e) }, { status: 500 });
  }
}
