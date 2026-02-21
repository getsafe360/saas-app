// app/api/reports/[siteId]/generate/route.ts
// Report generation API - PDF, CSV, HTML formats (Agency plan only)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { sites, teams, teamMembers, users, generatedReports, reportBranding, aiAnalysisJobs, aiRepairActions } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { currentUser } from '@clerk/nextjs/server';
import { canGenerateReports, canExportFormat, type PlanName } from '@/lib/plans/config';
import { put } from '@vercel/blob';
import type { ReportFormat, ReportScope, ReportMetadata } from '@/lib/db/schema/reports/generated';

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
 * POST /api/reports/[siteId]/generate
 *
 * Generate a report for a site in the specified format
 *
 * Body:
 * - format: 'pdf' | 'csv' | 'html'
 * - scope: 'full' | 'performance' | 'security' | 'seo' | 'accessibility' | 'custom'
 * - title?: string (optional custom title)
 * - categories?: string[] (for scope='custom')
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ siteId: string }> }
) {
  const params = await props.params;
  const { siteId } = params;

  try {
    const db = getDb();

    // Get user ID via Clerk
    const userId = await getAppUserId(db);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's team and plan
    const [membership] = await db
      .select({
        teamId: teamMembers.teamId,
        planName: teams.planName,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const planName = (membership.planName || 'free') as PlanName;

    // Check if plan allows report generation
    if (!canGenerateReports(planName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Report generation requires Agency plan',
          upgradeRequired: true,
          requiredPlan: 'agency',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const format = (body.format || 'pdf') as ReportFormat;
    const scope = (body.scope || 'performance') as ReportScope;
    const customTitle = body.title as string | undefined;
    const categories = body.categories as string[] | undefined;
    const whiteLabel = body.whiteLabel !== false;
    const locale = (body.locale || 'en') as string;

    // Check if specific format is available for plan
    if (!canExportFormat(planName, format)) {
      return NextResponse.json(
        {
          success: false,
          error: `${format.toUpperCase()} export not available for your plan`,
        },
        { status: 403 }
      );
    }

    // Get site details
    const [site] = await db
      .select({
        id: sites.id,
        siteUrl: sites.siteUrl,
        canonicalHost: sites.canonicalHost,
        lastScores: sites.lastScores,
        lastScreenshotUrl: sites.lastScreenshotUrl,
        userId: sites.userId,
      })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      );
    }

    // Get branding settings if available
    const [branding] = await db
      .select()
      .from(reportBranding)
      .where(eq(reportBranding.teamId, membership.teamId))
      .limit(1);

    const effectiveBranding = whiteLabel ? branding : null;

    // Create report record (pending status)
    const reportTitle = customTitle || generateReportTitle(site.canonicalHost || site.siteUrl, scope);
    const filename = generateFilename(site.canonicalHost || site.siteUrl, scope, format);

    const [report] = await db
      .insert(generatedReports)
      .values({
        teamId: membership.teamId,
        userId,
        siteId,
        format,
        scope,
        status: 'generating',
        title: reportTitle,
        filename,
        brandingApplied: effectiveBranding ? {
          companyName: effectiveBranding.companyName,
          logoUrl: effectiveBranding.logoUrl,
          config: effectiveBranding.config,
        } : null,
      })
      .returning();

    // Generate report content based on format
    let blobUrl: string | null = null;
    let blobKey: string | null = null;
    let metadata: ReportMetadata = {};

    try {
      const startTime = Date.now();

      // Get cockpit data for the site
      const cockpitData = await fetchCockpitData(siteId, locale);

      switch (format) {
        case 'pdf':
          const pdfResult = await generatePdfReport(site, cockpitData, scope, effectiveBranding, { whiteLabel, locale });
          blobUrl = pdfResult.url;
          blobKey = pdfResult.key;
          metadata = pdfResult.metadata;
          break;

        case 'csv':
          const csvResult = await generateCsvReport(site, cockpitData, scope);
          blobUrl = csvResult.url;
          blobKey = csvResult.key;
          metadata = csvResult.metadata;
          break;

        case 'html':
          const htmlResult = await generateHtmlReport(site, cockpitData, scope, effectiveBranding, { whiteLabel, locale });
          blobUrl = htmlResult.url;
          blobKey = htmlResult.key;
          metadata = htmlResult.metadata;
          break;
      }

      metadata.generationTimeMs = Date.now() - startTime;

      // Update report record with success
      await db
        .update(generatedReports)
        .set({
          status: 'completed',
          blobUrl,
          blobKey,
          metadata,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year retention
        })
        .where(eq(generatedReports.id, report.id));

      return NextResponse.json({
        success: true,
        report: {
          id: report.id,
          format,
          scope,
          title: reportTitle,
          filename,
          downloadUrl: blobUrl,
          metadata,
        },
      });

    } catch (generationError: any) {
      // Update report record with failure
      await db
        .update(generatedReports)
        .set({
          status: 'failed',
          errorMessage: generationError.message,
        })
        .where(eq(generatedReports.id, report.id));

      throw generationError;
    }

  } catch (error: any) {
    console.error(`[Reports] Generation error for site ${siteId}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate report',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/[siteId]/generate
 *
 * List generated reports for a site
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ siteId: string }> }
) {
  const params = await props.params;
  const { siteId } = params;

  try {
    const db = getDb();

    const userId = await getAppUserId(db);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get reports for this site
    const reports = await db
      .select({
        id: generatedReports.id,
        format: generatedReports.format,
        scope: generatedReports.scope,
        status: generatedReports.status,
        title: generatedReports.title,
        filename: generatedReports.filename,
        downloadUrl: generatedReports.blobUrl,
        metadata: generatedReports.metadata,
        createdAt: generatedReports.createdAt,
        generatedAt: generatedReports.generatedAt,
      })
      .from(generatedReports)
      .where(eq(generatedReports.siteId, siteId))
      .orderBy(generatedReports.createdAt);

    return NextResponse.json({
      success: true,
      reports: reports.reverse(), // Most recent first
    });

  } catch (error: any) {
    console.error(`[Reports] List error for site ${siteId}:`, error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

function generateReportTitle(siteHost: string, scope: ReportScope): string {
  const scopeLabels: Record<ReportScope, string> = {
    full: 'Complete Analysis',
    performance: 'Performance Optimization',
    security: 'Security Audit',
    seo: 'SEO Analysis',
    accessibility: 'Accessibility',
    custom: 'Custom',
  };

  return `${scopeLabels[scope]} Report - ${siteHost}`;
}

function generateFilename(siteHost: string, scope: ReportScope, format: ReportFormat): string {
  const date = new Date().toISOString().split('T')[0];
  const safeHost = siteHost.replace(/[^a-zA-Z0-9]/g, '-');
  return `${safeHost}-${scope}-report-${date}.${format}`;
}

async function fetchCockpitData(siteId: string, locale: string): Promise<any> {
  // Fetch the latest scan/cockpit data for the site
  const db = getDb();

  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    throw new Error('Site not found');
  }

  let analysisJob: any = null;
  let repairs: any[] = [];

  try {
    const [latestAnalysisJob] = await db
      .select()
      .from(aiAnalysisJobs)
      .where(eq(aiAnalysisJobs.siteId, siteId))
      .orderBy(desc(aiAnalysisJobs.createdAt))
      .limit(1);

    analysisJob = latestAnalysisJob ?? null;

    repairs = analysisJob
      ? await db
        .select()
        .from(aiRepairActions)
        .where(eq(aiRepairActions.analysisJobId, analysisJob.id))
      : [];
  } catch (error) {
    console.warn('[Reports] AI analysis/repair tables not ready yet, continuing without repair metadata.', error);
  }

  // Return the last scores and any additional cockpit data
  return {
    scores: site.lastScores,
    screenshotUrl: site.lastScreenshotUrl,
    faviconUrl: site.lastFaviconUrl,
    findingCount: site.lastFindingCount,
    cms: site.lastCms,
    locale,
    analysisJob,
    repairs,
  };
}

async function generatePdfReport(
  site: any,
  cockpitData: any,
  scope: ReportScope,
  branding: any,
  options: { whiteLabel: boolean; locale: string },
): Promise<{ url: string; key: string; metadata: ReportMetadata }> {
  const scores = cockpitData.scores || {};
  const overallScore = scores.performance || scores.overall || 75;
  const grade = getGrade(overallScore);

  // Build report HTML content
  const htmlContent = buildReportHtml(site, cockpitData, scope, branding, overallScore, grade, options);

  // Store as HTML for now (PDF conversion would happen via Puppeteer)
  const blob = await put(
    `reports/${site.id}/${Date.now()}-${scope}.pdf`,
    htmlContent,
    {
      contentType: 'application/pdf',
      access: 'public',
    }
  );

  return {
    url: blob.url,
    key: blob.pathname,
    metadata: {
      overallScore,
      overallGrade: grade,
      issuesFound: cockpitData.findingCount || 0,
      issuesFixed: 0,
      pageCount: 1,
    },
  };
}

async function generateCsvReport(
  site: any,
  cockpitData: any,
  scope: ReportScope
): Promise<{ url: string; key: string; metadata: ReportMetadata }> {
  const scores = cockpitData.scores || {};

  // Build CSV content
  const csvRows = [
    ['Metric', 'Score', 'Grade', 'Status'],
    ['Overall', scores.overall || 'N/A', getGrade(scores.overall), getStatus(scores.overall)],
    ['Performance', scores.performance || 'N/A', getGrade(scores.performance), getStatus(scores.performance)],
    ['Security', scores.security || 'N/A', getGrade(scores.security), getStatus(scores.security)],
    ['SEO', scores.seo || 'N/A', getGrade(scores.seo), getStatus(scores.seo)],
    ['Accessibility', scores.accessibility || 'N/A', getGrade(scores.accessibility), getStatus(scores.accessibility)],
  ];

  const csvContent = csvRows.map(row => row.join(',')).join('\n');

  const blob = await put(
    `reports/${site.id}/${Date.now()}-${scope}.csv`,
    csvContent,
    {
      contentType: 'text/csv',
      access: 'public',
    }
  );

  return {
    url: blob.url,
    key: blob.pathname,
    metadata: {
      overallScore: scores.overall || 0,
      overallGrade: getGrade(scores.overall),
    },
  };
}

async function generateHtmlReport(
  site: any,
  cockpitData: any,
  scope: ReportScope,
  branding: any,
  options: { whiteLabel: boolean; locale: string },
): Promise<{ url: string; key: string; metadata: ReportMetadata }> {
  const scores = cockpitData.scores || {};
  const overallScore = scores.performance || scores.overall || 75;
  const grade = getGrade(overallScore);

  const htmlContent = buildReportHtml(site, cockpitData, scope, branding, overallScore, grade, options);

  const blob = await put(
    `reports/${site.id}/${Date.now()}-${scope}.html`,
    htmlContent,
    {
      contentType: 'text/html',
      access: 'public',
    }
  );

  return {
    url: blob.url,
    key: blob.pathname,
    metadata: {
      overallScore,
      overallGrade: grade,
      issuesFound: cockpitData.findingCount || 0,
      issuesFixed: 0,
    },
  };
}

function buildReportHtml(
  site: any,
  cockpitData: any,
  scope: ReportScope,
  branding: any,
  overallScore: number,
  grade: string,
  options: { whiteLabel: boolean; locale: string },
): string {
  const primaryColor = branding?.config?.colors?.primary || '#2563eb';
  const companyName = branding?.companyName || 'GetSafe 360 AI';
  const logoUrl = branding?.logoUrl || '';
  const showPoweredBy = options.whiteLabel ? false : (branding?.config?.showPoweredBy ?? true);

  const scopeTitle: Record<ReportScope, string> = {
    full: 'Complete Site Analysis Report',
    performance: 'Performance Optimization Report',
    security: 'Security Audit Report',
    seo: 'SEO Analysis Report',
    accessibility: 'Accessibility Report',
    custom: 'Custom Analysis Report',
  };

  const repairedItems = (cockpitData.repairs || []).filter((item: any) => item.status === 'completed').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${scopeTitle[scope]} - ${site.canonicalHost || site.siteUrl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid ${primaryColor}; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo { height: 48px; max-width: 200px; object-fit: contain; }
    .company-name { font-size: 18px; font-weight: 600; }
    .date { font-size: 14px; color: #6b7280; text-align: right; }
    .title { font-size: 28px; font-weight: 700; color: ${primaryColor}; margin-bottom: 12px; }
    .site-info { font-size: 16px; color: #6b7280; }
    .summary { background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0; }
    .summary h2 { font-size: 18px; margin-bottom: 16px; }
    .score-cards { display: flex; gap: 16px; flex-wrap: wrap; }
    .score-card { flex: 1; min-width: 150px; background: white; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; }
    .score-value { font-size: 48px; font-weight: 700; color: ${primaryColor}; }
    .score-label { font-size: 12px; color: #6b7280; margin-top: 8px; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; text-align: center; }
    .powered-by { color: #9ca3af; }
    .powered-by span { color: ${primaryColor}; font-weight: 500; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo">` : ''}
      <div class="company-name">${companyName}</div>
    </div>
    <div class="date">
      <div style="font-size: 12px; color: #6b7280;">Generated on</div>
      <div style="font-weight: 500;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <h1 class="title">${scopeTitle[scope]}</h1>
  <div class="site-info">
    <div style="font-weight: 600;">${site.canonicalHost || site.siteUrl}</div>
    <div>${site.siteUrl}</div>
  </div>

  <div class="summary">
    <h2>Executive Summary</h2>
    <div class="score-cards">
      <div class="score-card">
        <div class="score-value">${overallScore}</div>
        <div style="font-size: 24px; font-weight: 600; color: ${primaryColor};">${grade}</div>
        <div class="score-label">Overall Score</div>
      </div>
      <div class="score-card">
        <div class="score-value">${cockpitData.findingCount || 0}</div>
        <div class="score-label">Issues Identified</div>
      </div>
      <div class="score-card">
        <div class="score-value">${repairedItems}</div>
        <div class="score-label">Repairs Executed</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>${companyName}</div>
    ${showPoweredBy ? '<div class="powered-by">Powered by <span>GetSafe 360 AI</span></div>' : ''}
  </div>
</body>
</html>`;
}

function getGrade(score: number | undefined): string {
  if (!score) return 'N/A';
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function getStatus(score: number | undefined): string {
  if (!score) return 'Unknown';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Improvement';
  return 'Critical';
}
