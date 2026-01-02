// app/api/sites/[id]/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq } from 'drizzle-orm';

/**
 * GET /api/sites/[id]/health
 * 
 * Quick health check endpoint for WordPress site connection
 * This is lighter than full reconnect - just checks if plugin responds
 * Pings the WordPress site to verify connectivity
 * 
 * Use cases:
 * - Monitoring dashboards
 * - Background health checks
 * - Quick status validation
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    // Get site from database
    const [site] = await db
      .select({
        id: sites.id,
        siteUrl: sites.siteUrl,
        tokenHash: sites.tokenHash,
        connectionStatus: sites.connectionStatus,
        lastConnectedAt: sites.lastConnectedAt,
      })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);

    if (!site) {
      return NextResponse.json(
        { 
          success: false,
          healthy: false,
          error: 'Site not found' 
        },
        { status: 404 }
      );
    }

    // Quick ping to WordPress plugin
    const wpApiUrl = `${site.siteUrl}/wp-json/getsafe360/v1/status`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (faster than reconnect)

    try {
      const response = await fetch(wpApiUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': site.tokenHash || '',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const healthy = response.ok;

      // Optional: Update last_connected_at if healthy
      if (healthy) {
        await db
          .update(sites)
          .set({ 
            lastConnectedAt: new Date(),
            connectionStatus: 'connected',
            connectionError: null,
          })
          .where(eq(sites.id, id));
      }

      return NextResponse.json({
        success: true,
        healthy,
        lastChecked: new Date().toISOString(),
        status: healthy ? 'connected' : 'unreachable',
        lastConnected: site.lastConnectedAt?.toISOString(),
        responseTime: healthy ? `${Date.now()}ms` : null,
      });

    } catch (fetchError: any) {
      // Health check failed
      return NextResponse.json({
        success: true, // Request succeeded, but site is unhealthy
        healthy: false,
        lastChecked: new Date().toISOString(),
        status: 'unreachable',
        error: fetchError.name === 'AbortError' ? 'Timeout' : 'Connection failed',
        lastConnected: site.lastConnectedAt?.toISOString(),
      });
    }

  } catch (error: any) {
    console.error(`[Health Check] Error for site ${id}:`, error);
    
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}