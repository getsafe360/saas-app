// app/api/sites/[id]/wordpress/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { eq } from 'drizzle-orm';
import { logDisconnection } from '@/lib/wordpress/logger';

/**
 * POST /api/sites/[id]/wordpress/disconnect
 *
 * Safely disconnect WordPress site
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  // 1. Authenticate user
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
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
    // Resolve internal DB user id from Clerk user id
    const db = getDrizzle();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Authenticated user not found in database'
          }
        },
        { status: 401 }
      );
    }

    // 2. Get site and verify ownership
    const [site] = await db
      .select({
        id: sites.id,
        userId: sites.userId,
        siteUrl: sites.siteUrl,
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

    if (site.userId !== user.id) {
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

    await logDisconnection(id);

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

export async function GET(
  _request: NextRequest,
  _props: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error: 'Use POST to disconnect a WordPress site'
    },
    { status: 405 }
  );
}
