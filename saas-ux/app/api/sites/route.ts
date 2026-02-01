// app/api/sites/route.ts
// List all sites for the authenticated user

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { sites, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { currentUser } from '@clerk/nextjs/server';

/**
 * Get the app user ID from either local session or Clerk
 */
async function getAppUserId(db: ReturnType<typeof getDb>): Promise<number | null> {
  // 1) Try local session user
  try {
    const u = await getUser();
    if (u?.id) return u.id;
  } catch {
    // ignore
  }

  // 2) Try Clerk user → map to app user
  const cu = await currentUser().catch(() => null);
  if (!cu) return null;

  const clerkId = cu.id;

  // Find existing mapping
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkId))
    .limit(1);

  return row?.id ?? null;
}

/**
 * GET /api/sites
 *
 * Returns all sites owned by the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    const userId = await getAppUserId(db);
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
