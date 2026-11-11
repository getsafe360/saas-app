// lib/reports/service.ts
//
// Request handling shared by the report routes: who may report on a site, the
// monthly quota, and turning a request into a rendered report.

import { and, count, eq, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { generatedReports, reportBranding } from '@/lib/db/schema';
import { getOwnedSite } from '@/lib/auth/site-access';
import { getOwnerTeam } from '@/lib/plans/owner-plan';
import { canGenerateReports, getReportsPerMonth, type PlanName } from '@/lib/plans/config';
import { resolveBrand } from './brand';
import { logoDataUrl } from './logo';
import { buildReportContent, REPORT_PERIODS, type ReportFormat, type ReportPeriodDays } from './content';
import { collectReportInput } from './data';
import { renderHtml, renderMarkdown } from './render';
import { isReportLocale, loadReportText, type ReportLocale } from './text';

export interface ReportContext {
  site: NonNullable<Awaited<ReturnType<typeof getOwnedSite>>>;
  userId: number;
  teamId: number | null;
  plan: PlanName;
}

/** The signed-in owner's site and plan, or null (answer 404). */
export async function reportContext(siteId: string): Promise<ReportContext | null> {
  const site = await getOwnedSite(siteId);
  if (!site?.userId) return null;
  const { teamId, planName } = await getOwnerTeam(site.userId);
  return { site, userId: site.userId, teamId, plan: planName };
}

export interface ReportOptions {
  format: ReportFormat;
  locale: ReportLocale;
  periodDays: ReportPeriodDays;
  whiteLabel: boolean;
}

/** Validates a request body or query; anything unknown falls back to a safe default. */
export function parseReportOptions(input: Record<string, unknown>, fallbackLocale: string): ReportOptions {
  const period = Number(input.periodDays);
  return {
    format: input.format === 'markdown' ? 'markdown' : 'pdf',
    locale: isReportLocale(input.locale) ? input.locale : isReportLocale(fallbackLocale) ? fallbackLocale : 'en',
    periodDays: (REPORT_PERIODS as ReadonlyArray<number>).includes(period) ? (period as ReportPeriodDays) : 30,
    whiteLabel: input.whiteLabel === true || input.whiteLabel === 'true',
  };
}

export interface Quota {
  used: number;
  /** 0 = unlimited. */
  limit: number;
}

/** Reports created by the team this calendar month (UTC). */
export async function reportQuota(context: ReportContext): Promise<Quota> {
  const limit = getReportsPerMonth(context.plan);
  if (!context.teamId || limit === 0) return { used: 0, limit };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await getDb()
    .select({ total: count() })
    .from(generatedReports)
    .where(
      and(
        eq(generatedReports.teamId, context.teamId),
        gte(generatedReports.createdAt, monthStart),
        eq(generatedReports.status, 'completed'),
      ),
    );
  return { used: row?.total ?? 0, limit };
}

export function canReport(plan: PlanName): boolean {
  return canGenerateReports(plan);
}

export interface RenderedReport {
  html: string;
  markdown: string;
  content: ReturnType<typeof buildReportContent>;
  brand: ReturnType<typeof resolveBrand>;
}

export async function renderReport(context: ReportContext, options: ReportOptions): Promise<RenderedReport> {
  const [input, text, branding] = await Promise.all([
    collectReportInput(context.site, options.periodDays),
    loadReportText(options.locale),
    context.teamId
      ? getDb()
          .select({ companyName: reportBranding.companyName, logoUrl: reportBranding.logoUrl, config: reportBranding.config })
          .from(reportBranding)
          .where(eq(reportBranding.teamId, context.teamId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const content = buildReportContent(input);
  const resolved = resolveBrand(context.plan, options.whiteLabel, branding);
  const brand = { ...resolved, logoUrl: await logoDataUrl(resolved.logoUrl) };
  return {
    content,
    brand,
    html: renderHtml(content, text, brand),
    markdown: renderMarkdown(content, text, brand),
  };
}
