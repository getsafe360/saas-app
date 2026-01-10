// app/api/sites/[id]/reconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq, sql } from 'drizzle-orm';
import { createWordPressClient, WordPressErrorCode } from '@/lib/wordpress/client';
import { logConnectionSuccess, logConnectionError } from '@/lib/wordpress/logger';
import { createWordPressConnection } from '@/lib/wordpress/auth';

/**
 * POST /api/sites/[id]/reconnect
 *
 * Reconnects to a WordPress site and updates connection status
 *
 * Requires user authentication and site ownership verification
 *
 * Flow:
 * 1. Authenticate user
 * 2. Verify site ownership
 * 3. Test WordPress connection
 * 4. Update connection status
 * 5. Log connection event
 * 6. Return updated status
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
    // Get database instance (lazy initialization)
    const db = getDrizzle();

    // 2. Get site from database and verify ownership
    const [site] = await db
      .select({
        id: sites.id,
        userId: sites.userId,
        siteUrl: sites.siteUrl,
        tokenHash: sites.tokenHash,
        connectionStatus: sites.connectionStatus,
        retryCount: sites.retryCount,
        wpVersion: sites.wpVersion,
        pluginVersion: sites.pluginVersion,
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

    // 3. Test WordPress connection using client
    const wpClient = createWordPressClient({
      siteUrl: site.siteUrl,
      tokenHash: site.tokenHash || undefined,
      timeout: 10000,
    });

    console.log(`[Reconnect] Testing connection to: ${site.siteUrl}`);

    const status = await wpClient.getStatus();

    console.log(`[Reconnect] Success! WordPress v${status.version}, Plugin v${status.pluginVersion}`);

    // 4. Update connection status and WordPress connection metadata
    const wordpressConnection = createWordPressConnection({
      tokenHash: site.tokenHash || '',
      pluginVersion: status.pluginVersion,
      wpVersion: status.version,
      siteUrl: site.siteUrl,
    });

    await db
      .update(sites)
      .set({
        connectionStatus: 'connected',
        lastConnectedAt: new Date(),
        connectionError: null,
        retryCount: 0,
        wpVersion: status.version,
        pluginVersion: status.pluginVersion,
        wordpressConnection: wordpressConnection as any,
      })
      .where(eq(sites.id, id));

    // 5. Log successful connection
    await logConnectionSuccess(id);

    return NextResponse.json({
      success: true,
      data: {
        status: 'connected',
        lastConnected: new Date().toISOString(),
        wordpress: {
          version: status.version,
          pluginVersion: status.pluginVersion,
        },
      },
    });

  } catch (error: any) {
    console.error(`[Reconnect] Error for site ${id}:`, error);

    // Get user-friendly error details
    const wpError = error.code && WordPressErrorCode[error.code as keyof typeof WordPressErrorCode]
      ? error.toJSON()
      : {
          code: 'CONNECTION_FAILED',
          title: 'Connection Failed',
          message: 'Could not reach WordPress site',
          action: 'Check your site URL and try again',
          details: error.message,
        };

    // Update database with error status
    try {
      await db
        .update(sites)
        .set({
          connectionStatus: 'error',
          connectionError: `${wpError.code}: ${wpError.message}`,
          retryCount: sql`COALESCE(${sites.retryCount}, 0) + 1`,
        })
        .where(eq(sites.id, id));

      // Log connection error
      await logConnectionError(id, wpError.message, 'error');
    } catch (dbError) {
      console.error(`[Reconnect] Failed to update error status:`, dbError);
    }

    return NextResponse.json(
      {
        success: false,
        error: wpError,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sites/[id]/reconnect
 *
 * Get current connection status for a site
 *
 * Requires user authentication and site ownership verification
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  // Authenticate user
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
    const db = getDrizzle();
    const [site] = await db
      .select({
        id: sites.id,
        userId: sites.userId,
        connectionStatus: sites.connectionStatus,
        lastConnectedAt: sites.lastConnectedAt,
        connectionError: sites.connectionError,
        retryCount: sites.retryCount,
      })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);

    if (!site) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Site not found' }
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

    return NextResponse.json({
      success: true,
      data: {
        status: site.connectionStatus,
        lastConnected: site.lastConnectedAt?.toISOString(),
        error: site.connectionError,
        retryCount: site.retryCount,
      },
    });

  } catch (error: any) {
    console.error(`[Reconnect Status] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: { message: error.message }
      },
      { status: 500 }
    );
  }
}