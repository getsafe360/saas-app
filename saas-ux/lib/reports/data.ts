// lib/reports/data.ts
//
// Collects what a client report needs from the database (server only): the
// stored scores, the changes GetSafe 360 made, WordPress health over the
// period and what is still open.

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { parseStoredSite } from '@/lib/cockpit/stored';
import { getDrizzle } from '@/lib/db/postgres';
import { wordpressSiteSnapshots } from '@/lib/db/schema/wordpress/agent';
import { scanJobs } from '@/lib/db/schema';
import type { ScanReport } from '@/lib/scan/types';
import { readTestState } from '@/lib/security/csp/reports';
import { toAppliedChanges } from '@/lib/wordpress/applied-changes';
import { loadChangeRuns } from '@/lib/wordpress/change-runs';
import type { WordPressSiteSnapshot } from '@/lib/wordpress/types';
import type { ReportInput, ReportIssueInput, ReportPeriodDays, IssueSeverity } from './content';

/** Enough history for a year of reports on a busy site. */
const CHANGE_LIMIT = 500;

export interface ReportSite {
  id: string;
  siteUrl: string;
  canonicalHost: string | null;
  lastScores: unknown;
}

const SEVERITIES: ReadonlyArray<IssueSeverity> = ['critical', 'high', 'medium', 'low'];
const asSeverity = (value: unknown): IssueSeverity =>
  SEVERITIES.includes(value as IssueSeverity) ? (value as IssueSeverity) : 'medium';

function hostOf(site: ReportSite): string {
  if (site.canonicalHost) return site.canonicalHost.replace(/^www\./, '');
  try {
    return new URL(site.siteUrl).hostname.replace(/^www\./, '');
  } catch {
    return site.siteUrl;
  }
}

type HealthRow = { snapshot: unknown; createdAt: Date };
const healthOf = (row: HealthRow | undefined) => (row?.snapshot as WordPressSiteSnapshot | undefined)?.health ?? null;

async function wordpressHealth(siteId: string, periodStart: Date) {
  const db = getDrizzle();
  const hasScore = sql`jsonb_typeof(${wordpressSiteSnapshots.snapshot}->'health'->'overall') = 'number'`;
  const select = { snapshot: wordpressSiteSnapshots.snapshot, createdAt: wordpressSiteSnapshots.createdAt };

  const [latest] = await db
    .select(select)
    .from(wordpressSiteSnapshots)
    .where(and(eq(wordpressSiteSnapshots.siteId, siteId), hasScore))
    .orderBy(desc(wordpressSiteSnapshots.createdAt))
    .limit(1);
  if (!latest) return { health: null, problems: [] as ReportIssueInput[] };

  // The score at the start of the period: the last one before it, else the first one inside it.
  const [before] = await db
    .select(select)
    .from(wordpressSiteSnapshots)
    .where(and(eq(wordpressSiteSnapshots.siteId, siteId), hasScore, lte(wordpressSiteSnapshots.createdAt, periodStart)))
    .orderBy(desc(wordpressSiteSnapshots.createdAt))
    .limit(1);
  const [first] = before
    ? [before]
    : await db
        .select(select)
        .from(wordpressSiteSnapshots)
        .where(and(eq(wordpressSiteSnapshots.siteId, siteId), hasScore, gte(wordpressSiteSnapshots.createdAt, periodStart)))
        .orderBy(asc(wordpressSiteSnapshots.createdAt))
        .limit(1);

  const now = healthOf(latest);
  const start = healthOf(first);
  return {
    health: { before: start?.overall ?? null, now: now?.overall ?? null },
    problems: (now?.problems ?? []).map((problem) => ({ id: problem.id, severity: asSeverity(problem.severity) })),
  };
}

/**
 * Every issue of the site's latest finished scan. The cockpit snapshot keeps only
 * the top three, which would hide open issues once those three are fixed.
 */
async function scanIssues(siteId: string, fallback: ReportIssueInput[]): Promise<ReportIssueInput[]> {
  try {
    const [job] = await getDrizzle()
      .select({ id: scanJobs.id, reportBlobKey: scanJobs.reportBlobKey })
      .from(scanJobs)
      .where(and(eq(scanJobs.siteId, siteId), eq(scanJobs.status, 'done')))
      .orderBy(desc(scanJobs.updatedAt))
      .limit(1);
    if (!job) return fallback;
    const key = job.reportBlobKey || `scan-results/${job.id}.json`;
    const { blobs } = await list({ prefix: key });
    const match = blobs.find((blob) => blob.pathname === key);
    if (!match) return fallback;
    const response = await fetch(match.url, { cache: 'no-store' });
    const body = (await response.json().catch(() => null)) as { report?: ScanReport } | null;
    const issues = body?.report?.issues;
    if (!Array.isArray(issues)) return fallback;
    return issues.map((issue) => ({ id: issue.id, severity: asSeverity(issue.severity), title: issue.title }));
  } catch {
    return fallback;
  }
}

export async function collectReportInput(
  site: ReportSite,
  periodDays: ReportPeriodDays,
  generatedAt = new Date(),
): Promise<ReportInput> {
  const periodStart = new Date(generatedAt.getTime() - periodDays * 86_400_000);
  const stored = parseStoredSite(site.lastScores);
  const scan = stored.scan;
  const quick = stored.scores;
  const pick = (category: 'performance' | 'security' | 'seo' | 'accessibility') =>
    scan?.categoryScores?.[category] ?? quick?.[category] ?? null;

  const db = getDrizzle();
  const topIssues: ReportIssueInput[] = (scan?.top ?? []).map((issue) => ({
    id: issue.id,
    severity: asSeverity(issue.severity),
    title: issue.title,
  }));
  const [runs, wordpress, cspState, scanIssueList] = await Promise.all([
    loadChangeRuns(db, site.id, CHANGE_LIMIT),
    wordpressHealth(site.id, periodStart).catch(() => ({ health: null, problems: [] as ReportIssueInput[] })),
    readTestState(site.id).catch(() => null),
    scan ? scanIssues(site.id, topIssues) : Promise.resolve([] as ReportIssueInput[]),
  ]);

  return {
    site: { host: hostOf(site), url: site.siteUrl },
    generatedAt,
    periodDays,
    scores: {
      overall: scan?.overall ?? quick?.overall ?? null,
      performance: pick('performance'),
      security: pick('security'),
      seo: pick('seo'),
      accessibility: pick('accessibility'),
      content: quick?.content ?? null,
    },
    wordpressHealth: wordpress.health,
    changes: toAppliedChanges(runs, CHANGE_LIMIT),
    openIssues: [...wordpress.problems, ...scanIssueList],
    cspTestSince: cspState ? new Date(cspState.startedAt) : null,
  };
}
