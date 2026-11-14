// app/api/sites/[id]/seo-geo/route.ts
//
// GET: the latest SEO/GEO check results for the site (null before the first run).
// POST: crawls the site (robots.txt, llms.txt, sitemap and up to 10 pages) and
// stores the result. Measured facts only; no AI involved.

import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { evaluateSeoGeo } from '@/lib/engine/seo/report';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { crawlSite } from '@/lib/seo/crawl';
import { loadCrawl, loadScoreHistory, saveCrawl } from '@/lib/seo/store';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId);
  if ('error' in access) return access.error;

  const [crawl, history] = await Promise.all([loadCrawl(siteId), loadScoreHistory(siteId)]);
  return NextResponse.json({ success: true, report: crawl ? evaluateSeoGeo(crawl) : null, history }, { headers: NO_STORE });
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId);
  if ('error' in access) return access.error;

  const limit = await rateLimit(`seo-geo:${siteId}`, 6, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });

  let crawl;
  try {
    crawl = await crawlSite(access.site.siteUrl, { validate: isPublicUrlResolved });
  } catch (error) {
    console.error('[seo-geo] crawl failed', error);
    return NextResponse.json({ success: false, error: 'CRAWL_FAILED' }, { status: 502 });
  }
  if (crawl.pages.length === 0) {
    return NextResponse.json({ success: false, error: 'SITE_UNREACHABLE' }, { status: 502 });
  }

  const report = evaluateSeoGeo(crawl);
  await saveCrawl(siteId, crawl, report.scores);
  return NextResponse.json({ success: true, report, history: await loadScoreHistory(siteId) }, { headers: NO_STORE });
}
