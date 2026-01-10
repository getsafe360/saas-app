// app/api/sites/[id]/wordpress/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq } from 'drizzle-orm';
import { createWordPressClient } from '@/lib/wordpress/client';

// Use shared database client to prevent connection pool exhaustion
const db = getDrizzle();

/**
 * POST /api/sites/[id]/wordpress/test
 *
 * Test WordPress connection without modifying database
 *
 * Returns detailed diagnostics for troubleshooting:
 * - Site reachability
 * - Plugin installation status
 * - Authentication status
 * - WordPress version
 * - Plugin version
 *
 * Requires user authentication and site ownership verification
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  // 1. Authenticate user
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      },
      { status: 401 }
    );
  }

  try {
    // 2. Get site and verify ownership
    const [site] = await db
      .select({
        id: sites.id,
        userId: sites.userId,
        siteUrl: sites.siteUrl,
        tokenHash: sites.tokenHash,
      })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);

    if (!site) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SITE_NOT_FOUND',
            message: 'Site not found'
          }
        },
        { status: 404 }
      );
    }

    // Verify site ownership
    if (site.userId.toString() !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this site'
          }
        },
        { status: 403 }
      );
    }

    // 3. Test WordPress connection
    const wpClient = createWordPressClient({
      siteUrl: site.siteUrl,
      tokenHash: site.tokenHash || undefined,
      timeout: 10000,
    });

    console.log(`[Test] Testing connection to: ${site.siteUrl}`);

    const testResult = await wpClient.testConnection();

    console.log(`[Test] Result:`, JSON.stringify(testResult, null, 2));

    return NextResponse.json({
      success: testResult.success,
      diagnostics: {
        siteUrl: site.siteUrl,
        reachable: testResult.reachable,
        pluginInstalled: testResult.pluginInstalled,
        authenticated: testResult.authenticated,
        wpVersion: testResult.wpVersion,
        pluginVersion: testResult.pluginVersion,
      },
      error: testResult.error ? testResult.error.toJSON() : undefined,
    });

  } catch (error: any) {
    console.error(`[Test] Error for site ${id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TEST_FAILED',
          message: 'Connection test failed',
          details: error.message,
        },
      },
      { status: 500 }
    );
  }
}
