// app/api/reports/[siteId]/generate/route.ts
//
// POST: creates a client report (PDF or Markdown) for a site the user owns,
//       stores it and returns its id. Pro: 5 a month per team; Agency: unlimited.
// GET:  the site's reports, newest first, with this month's quota.
//
// Files are only handed out through ./[reportId]/download, after an ownership
// check; the storage URL is never sent to the browser.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { getDb } from '@/lib/db/drizzle';
import { generatedReports } from '@/lib/db/schema';
import { rateLimit } from '@/lib/api/rate-limit';
import { canExportFormat } from '@/lib/plans/config';
import { reportFilename } from '@/lib/reports/content';
import { htmlToPdf } from '@/lib/reports/pdf';
import { canReport, parseReportOptions, renderReport, reportContext, reportQuota } from '@/lib/reports/service';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest, props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await props.params;
  const context = await reportContext(siteId);
  if (!context) return json({ success: false, error: 'SITE_NOT_FOUND' }, 404);
  if (!canReport(context.plan)) return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);

  const limited = await rateLimit(`report-generate:${siteId}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return json({ success: false, error: 'RATE_LIMITED' }, 429);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const options = parseReportOptions(body, 'en');
  if (!canExportFormat(context.plan, options.format)) return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);

  const quota = await reportQuota(context);
  if (quota.limit > 0 && quota.used >= quota.limit) {
    return json({ success: false, error: 'QUOTA_EXHAUSTED', quota }, 403);
  }
  if (!context.teamId) return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);

  const rendered = await renderReport(context, options);
  const filename = reportFilename(rendered.content.site.host, rendered.content.generatedAt, options.format);
  const db = getDb();
  const [report] = await db
    .insert(generatedReports)
    .values({
      teamId: context.teamId,
      userId: context.userId,
      siteId,
      format: options.format,
      scope: 'full',
      status: 'generating',
      title: rendered.content.site.host,
      filename,
      brandingApplied: rendered.brand.poweredBy ? null : { companyName: rendered.brand.companyName, logoUrl: rendered.brand.logoUrl },
    })
    .returning({ id: generatedReports.id });

  try {
    const file =
      options.format === 'pdf'
        ? await htmlToPdf(rendered.html, rendered.brand.logoUrl ? [rendered.brand.logoUrl] : [])
        : Buffer.from(rendered.markdown, 'utf8');
    const blob = await put(`reports/${siteId}/${report.id}/${filename}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: options.format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8',
    });
    await db
      .update(generatedReports)
      .set({
        status: 'completed',
        blobUrl: blob.url,
        blobKey: blob.pathname,
        generatedAt: new Date(),
        metadata: {
          overallScore: rendered.content.scores.overall ?? undefined,
          issuesFound: rendered.content.openIssues.length,
          issuesFixed: rendered.content.fixes.length,
          locale: options.locale,
          periodDays: options.periodDays,
        },
      })
      .where(eq(generatedReports.id, report.id));
  } catch (error) {
    console.error('[reports] generation failed', error);
    await db
      .update(generatedReports)
      .set({ status: 'failed', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'failed' })
      .where(eq(generatedReports.id, report.id));
    return json({ success: false, error: 'GENERIC' }, 500);
  }

  return json({
    success: true,
    report: { id: report.id, filename, format: options.format, downloadUrl: `/api/reports/${siteId}/${report.id}/download` },
    quota: { ...quota, used: quota.used + 1 },
  });
}

export async function GET(_request: NextRequest, props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await props.params;
  const context = await reportContext(siteId);
  if (!context) return json({ success: false, error: 'SITE_NOT_FOUND' }, 404);

  const rows = await getDb()
    .select({
      id: generatedReports.id,
      format: generatedReports.format,
      status: generatedReports.status,
      filename: generatedReports.filename,
      metadata: generatedReports.metadata,
      createdAt: generatedReports.createdAt,
    })
    .from(generatedReports)
    .where(eq(generatedReports.siteId, siteId))
    .orderBy(desc(generatedReports.createdAt))
    .limit(50);

  return json({
    success: true,
    plan: context.plan,
    quota: await reportQuota(context),
    reports: rows.map((row) => ({
      id: row.id,
      format: row.format,
      status: row.status,
      filename: row.filename,
      locale: row.metadata?.locale ?? null,
      periodDays: row.metadata?.periodDays ?? null,
      fixes: row.metadata?.issuesFixed ?? null,
      createdAt: row.createdAt.toISOString(),
      downloadUrl: row.status === 'completed' ? `/api/reports/${siteId}/${row.id}/download` : null,
    })),
  });
}
