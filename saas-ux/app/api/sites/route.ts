// app/api/sites/route.ts
// List all sites for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { sites, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

/**
 * GET /api/sites
 *
 * Returns all sites owned by the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const db = getDb();

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
    const transformedSites = userSites.map(site => ({
      id: site.id,
      siteUrl: site.siteUrl,
      canonicalHost: site.canonicalHost || new URL(site.siteUrl).hostname,
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
    }));

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
