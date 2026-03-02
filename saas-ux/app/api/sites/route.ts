// app/api/sites/route.ts
// List all sites for the authenticated user

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { ensureAppUserId } from '@/lib/auth/ensure-app-user';

type CreateSiteRequest = {
  url?: string;
  platform?: string;
  initialAnalysis?: {
    summary?: string;
    categories?: unknown[];
    scores?: {
      overall?: number;
      seo?: number;
      a11y?: number;
      perf?: number;
      sec?: number;
    };
    findings?: unknown[];
    faviconUrl?: string;
  };
};

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const url = new URL(u);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

/**
 * GET /api/sites
 *
 * Returns all sites owned by the authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    const userId = await ensureAppUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all sites for this user
    const userSites = await db
      .select({
        id: sites.id,
        siteUrl: sites.siteUrl,
        canonicalHost: sites.canonicalHost,
        lastScores: sites.lastScores,
        lastFaviconUrl: sites.lastFaviconUrl,
        lastScreenshotUrl: sites.lastScreenshotUrl,
        lastCms: sites.lastCms,
        lastFindingCount: sites.lastFindingCount,
        status: sites.status,
        createdAt: sites.createdAt,
        updatedAt: sites.updatedAt,
      })
      .from(sites)
      .where(eq(sites.userId, userId))
      .orderBy(sites.updatedAt);

    // Transform for frontend
    const transformedSites = userSites.map(site => {
      let canonicalHost = site.canonicalHost;
      if (!canonicalHost) {
        try {
          canonicalHost = new URL(site.siteUrl).hostname;
        } catch {
          canonicalHost = site.siteUrl;
        }
      }

      return {
        id: site.id,
        siteUrl: site.siteUrl,
        canonicalHost,
        lastScores: site.lastScores as {
          performance?: number;
          security?: number;
          seo?: number;
          accessibility?: number;
          overall?: number;
        } | null,
        lastFaviconUrl: site.lastFaviconUrl,
        lastScreenshotUrl: site.lastScreenshotUrl,
        cms: site.lastCms,
        findingCount: site.lastFindingCount,
        status: site.status,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      sites: transformedSites.reverse(), // Most recent first
    });

  } catch (error: any) {
    console.error('[Sites] List error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites
 *
 * Creates (or reuses) a site for the authenticated user and stores initial analysis snapshot.
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const userId = await ensureAppUserId();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as CreateSiteRequest | null;
    const rawUrl = body?.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ success: false, error: 'URL_REQUIRED' }, { status: 400 });
    }

    let siteUrl: string;
    try {
      siteUrl = normalizeUrl(rawUrl);
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_URL' }, { status: 400 });
    }

    const parsed = new URL(siteUrl);
    const canonicalHost = parsed.hostname;
    const canonicalRoot = `${parsed.protocol}//${parsed.hostname}`;

    const [existingSite] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.userId, userId), eq(sites.canonicalHost, canonicalHost)))
      .limit(1);

    const scores = body?.initialAnalysis?.scores;
    const findings = Array.isArray(body?.initialAnalysis?.findings)
      ? body?.initialAnalysis?.findings
      : [];

    const commonValues = {
      siteUrl,
      canonicalHost,
      canonicalRoot,
      status: 'connected' as const,
      cms: body?.platform || null,
      lastCms: body?.platform || null,
      lastScores: scores
        ? {
            overall: scores.overall ?? null,
            seo: scores.seo ?? null,
            a11y: scores.a11y ?? null,
            perf: scores.perf ?? null,
            sec: scores.sec ?? null,
          }
        : null,
      lastFaviconUrl: body?.initialAnalysis?.faviconUrl || null,
      lastFindingCount: findings.length || null,
      updatedAt: new Date(),
    };

    if (existingSite?.id) {
      await db
        .update(sites)
        .set(commonValues as any)
        .where(eq(sites.id, existingSite.id));

      return NextResponse.json({ success: true, siteId: existingSite.id, reused: true });
    }

    const [created] = await db
      .insert(sites)
      .values({
        ...commonValues,
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date(),
      } as any)
      .returning({ id: sites.id });

    if (!created?.id) {
      return NextResponse.json({ success: false, error: 'SITE_CREATE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true, siteId: created.id, reused: false });
  } catch (error: any) {
    console.error('[Sites] Create error:', error);
    return NextResponse.json(
      { success: false, error: error.message ?? 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}
