/**
 * AI Crew Analysis API Route
 * Bridges Next.js frontend with Python FastAPI microservice
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { aiCrewClient } from '@/lib/services/ai-crew-client';
import { db } from '@/lib/db/client';
import { sites } from '@/lib/db/schema/sites/sites';
import { eq } from 'drizzle-orm';

export const maxDuration = 60; // 60 seconds for analysis

/**
 * POST /api/ai-crew/analyze
 *
 * Analyze a website using AI agents
 *
 * Body:
 * {
 *   url: string;
 *   modules: string[];
 *   siteId?: string;
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
    const { url, modules = ['seo', 'performance', 'security', 'accessibility'], siteId } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate modules
    const validModules = ['seo', 'performance', 'security', 'accessibility', 'content'];
    const selectedModules = modules.filter((m: string) => validModules.includes(m));

    if (selectedModules.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid module is required' },
        { status: 400 }
      );
    }

    // If siteId provided, verify ownership
    if (siteId) {
      const [site] = await db
        .select()
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);

      if (!site) {
        return NextResponse.json(
          { error: 'Site not found' },
          { status: 404 }
        );
      }

      // TODO: Add user ownership check when user-site relationship is available
      // if (site.userId !== userId) {
      //   return NextResponse.json(
      //     { error: 'Forbidden' },
      //     { status: 403 }
      //   );
      // }
    }

    // Get user locale from headers
    const locale = request.headers.get('accept-language')?.split(',')[0] || 'en';

    console.log(`[AI-Crew] Analyzing ${url} with modules: ${selectedModules.join(', ')}`);

    // Call Python microservice
    const analysisResult = await aiCrewClient.analyze({
      url,
      modules: selectedModules,
      siteId,
      locale,
    });

    // TODO: Store analysis results in database
    // await db.insert(aiAnalysisJobs).values({
    //   siteId,
    //   userId,
    //   jobId: analysisResult.jobId,
    //   selectedModules,
    //   results: analysisResult.results,
    //   issuesFound: Object.values(analysisResult.results).reduce((sum, r) => sum + r.issues.length, 0),
    //   repairableIssues: Object.values(analysisResult.results).reduce((sum, r) => sum + r.fixes.length, 0),
    // });

    console.log(`[AI-Crew] Analysis completed: ${analysisResult.jobId}`);

    return NextResponse.json({
      success: true,
      data: analysisResult,
    });

  } catch (error: any) {
    console.error('[AI-Crew] Analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Analysis failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-crew/analyze/[jobId]
 *
 * Get analysis results by job ID
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Implement fetching analysis from database
    // const { searchParams } = new URL(request.url);
    // const jobId = searchParams.get('jobId');

    return NextResponse.json({
      success: false,
      error: 'Not implemented yet',
    }, { status: 501 });

  } catch (error: any) {
    console.error('[AI-Crew] Get analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get analysis',
      },
      { status: 500 }
    );
  }
}
