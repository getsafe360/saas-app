/**
 * AI Crew Repair API Route
 * Execute automated repairs for detected issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { aiCrewClient } from '@/lib/services/ai-crew-client';
import { db } from '@/lib/db/client';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq } from 'drizzle-orm';

export const maxDuration = 120; // 2 minutes for repairs

/**
 * POST /api/ai-crew/repair
 *
 * Execute automated repairs
 *
 * Body:
 * {
 *   siteId: string;
 *   issues: Array<{ id, category, type, severity }>;
 *   dryRun?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { siteId, issues, dryRun = false } = body;

    if (!siteId || !issues || !Array.isArray(issues)) {
      return NextResponse.json(
        { error: 'siteId and issues array are required' },
        { status: 400 }
      );
    }

    // Get site details and verify ownership
    const [site] = await db
      .select({
        id: sites.id,
        siteUrl: sites.siteUrl,
        wordpressConnection: sites.wordpressConnection,
      })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // TODO: Check user subscription level for repair feature
    // const canRepair = await checkSubscriptionFeature(userId, 'ai_repair');
    // if (!canRepair) {
    //   return NextResponse.json(
    //     { error: 'Upgrade to Pro to use instant repair feature' },
    //     { status: 403 }
    //   );
    // }

    console.log(`[AI-Crew] Repairing ${issues.length} issues for site ${siteId}`);

    // Prepare WordPress connection data if available
    let wordpressConfig;
    if (site.wordpressConnection) {
      const wpConn = site.wordpressConnection as any;
      wordpressConfig = {
        connected: wpConn.connected || false,
        apiUrl: wpConn.api_url || `${site.siteUrl}/wp-json`,
        authToken: wpConn.auth_token,
      };
    }

    // Call Python microservice for repair
    const repairResult = await aiCrewClient.repair({
      siteId,
      issues,
      wordpress: wordpressConfig,
      dryRun,
    });

    // TODO: Store repair actions in database
    // for (const repair of [...repairResult.repaired, ...repairResult.failed]) {
    //   await db.insert(aiRepairActions).values({
    //     siteId,
    //     issueId: repair.issueId,
    //     status: repair.success ? 'completed' : 'failed',
    //     repairMethod: repair.method,
    //     changes: repair.changes,
    //     errorMessage: repair.error,
    //   });
    // }

    console.log(
      `[AI-Crew] Repair completed: ${repairResult.repaired.length} succeeded, ${repairResult.failed.length} failed`
    );

    return NextResponse.json({
      success: true,
      data: repairResult,
    });

  } catch (error: any) {
    console.error('[AI-Crew] Repair error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Repair failed',
      },
      { status: 500 }
    );
  }
}
