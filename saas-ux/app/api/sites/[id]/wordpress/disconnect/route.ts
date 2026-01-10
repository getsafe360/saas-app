// app/api/sites/[id]/wordpress/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq } from 'drizzle-orm';
import { logDisconnection } from '@/lib/wordpress/logger';

// Use shared database client to prevent connection pool exhaustion
const db = getDrizzle();

/**
 * POST /api/sites/[id]/wordpress/disconnect
 *
 * Safely disconnect WordPress site
 *
 * This will:
 * - Clear connection credentials
 * - Update connection status to 'disconnected'
 * - Log disconnection event
 *
 * The site record remains in the database for reconnection.
 * To completely delete the site, use DELETE /api/sites/[id]
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
        connectionStatus: sites.connectionStatus,
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

    // 3. Disconnect WordPress site
    await db
      .update(sites)
      .set({
        connectionStatus: 'disconnected',
        tokenHash: null,
        wordpressConnection: null,
        connectionError: null,
        retryCount: 0,
        lastConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, id));

    // 4. Log disconnection
    await logDisconnection(id);

    console.log(`[Disconnect] Successfully disconnected site ${id}`);

    return NextResponse.json({
      success: true,
      message: 'WordPress site disconnected successfully',
      data: {
        siteId: id,
        status: 'disconnected',
        siteUrl: site.siteUrl,
      },
    });

  } catch (error: any) {
    console.error(`[Disconnect] Error for site ${id}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DISCONNECT_FAILED',
          message: 'Failed to disconnect WordPress site',
          details: error.message,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sites/[id]/wordpress/disconnect
 *
 * Get disconnection status (not typically used, but provided for consistency)
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error: 'Use POST to disconnect a WordPress site'
    },
    { status: 405 }
  );
}
