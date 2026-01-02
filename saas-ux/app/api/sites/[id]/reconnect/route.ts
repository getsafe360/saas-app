// app/api/sites/[id]/reconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

// Create db instance if not already exported
const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

// Import your sites table
import { sites } from '@/lib/db/schema/sites/sites';
import { eq, sql } from 'drizzle-orm';

/**
 * POST /api/sites/[id]/reconnect
 * 
 * Reconnects to a WordPress site and updates connection status
 * 
 * Flow:
 * 1. Validate site exists
 * 2. Ping WordPress REST API endpoint
 * 3. Update connection status in database
 * 4. Trigger data sync if successful
 * 5. Return updated status
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    // 1. Get site from database using Drizzle query
    const [site] = await db
      .select({
        id: sites.id,
        siteUrl: sites.siteUrl,
        tokenHash: sites.tokenHash,
        connectionStatus: sites.connectionStatus,
        retryCount: sites.retryCount,
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

    // 2. Attempt to ping WordPress REST API
    const wpApiUrl = `${site.siteUrl}/wp-json/getsafe360/v1/status`;
    
    console.log(`[Reconnect] Attempting to reach: ${wpApiUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(wpApiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': site.tokenHash || '',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`WordPress API returned ${response.status}: ${response.statusText}`);
    }

    const wpData = await response.json();

    console.log(`[Reconnect] Success! WordPress version: ${wpData.version || 'unknown'}`);

    // 3. Update connection status to connected
    await db
      .update(sites)
      .set({
        connectionStatus: 'connected',
        lastConnectedAt: new Date(),
        connectionError: null,
        retryCount: 0,
      })
      .where(eq(sites.id, id));

    // 4. Trigger fresh data sync (optional - implement based on your sync strategy)
    // await syncWordPressData(id);
    
    // You could also trigger a background job here:
    // await triggerSyncJob(id);

    return NextResponse.json({
      success: true,
      data: {
        status: 'connected',
        lastConnected: new Date().toISOString(),
        wordpress: wpData,
      },
    });

  } catch (error: any) {
    console.error(`[Reconnect] Error for site ${id}:`, error);

    // Determine error type
    let errorCode = 'CONNECTION_FAILED';
    let errorMessage = 'Could not reach WordPress site';
    let errorDetails = error.message;

    if (error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = 'Connection timeout after 10 seconds';
      errorDetails = 'WordPress site did not respond in time';
    } else if (error.message.includes('404')) {
      errorCode = 'ENDPOINT_NOT_FOUND';
      errorMessage = 'WordPress API endpoint not found';
      errorDetails = 'Plugin may not be installed or activated';
    } else if (error.message.includes('403') || error.message.includes('401')) {
      errorCode = 'AUTHENTICATION_FAILED';
      errorMessage = 'Authentication failed';
      errorDetails = 'API key may be invalid or missing';
    }

    // Update database with error status
    try {
      await db
        .update(sites)
        .set({
          connectionStatus: 'error',
          connectionError: `${errorCode}: ${errorMessage}`,
          retryCount: sql`${sites.retryCount} + 1`,
        })
        .where(eq(sites.id, id));
    } catch (dbError) {
      console.error(`[Reconnect] Failed to update error status:`, dbError);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sites/[id]/reconnect
 * 
 * Get current connection status for a site
 */

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const [site] = await db
      .select({
        id: sites.id,
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