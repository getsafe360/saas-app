// lib/reports/content.ts
//
// What a client report says, independent of format and language: the scores,
// what GetSafe 360 changed on the site in the period, and what is still open.
// Pure, so the Markdown and PDF renderers and the tests share one source.

import { getScoreGrade } from '@/lib/cockpit/transform-api-data';
import type { AppliedChange } from '@/lib/wordpress/applied-changes';
import type { ReportFormat, ReportPeriodDays } from './options';
export { REPORT_PERIODS, type ReportFormat, type ReportPeriodDays } from './options';

export const REPORT_CATEGORIES = ['performance', 'security', 'seo', 'accessibility', 'content'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ReportIssueInput {
  id: string;
  severity: IssueSeverity;
  /** English title, used when no translation exists. */
  title?: string;
}

export interface ReportInput {
  site: { host: string; url: string };
  generatedAt: Date;
  periodDays: ReportPeriodDays;
  scores: { overall: number | null } & Partial<Record<ReportCategory, number | null>>;
  /** WordPress health at the start of the period and now (connected sites). */
  wordpressHealth: { before: number | null; now: number | null } | null;
  changes: ReadonlyArray<AppliedChange>;
  openIssues: ReadonlyArray<ReportIssueInput>;
  /** A Content-Security-Policy is being tested in report-only mode. */
  cspTestSince: Date | null;
}

export interface ReportFix {
  /** Finding the change addressed; drives the translated title and "why it matters". */
  findingId: string | null;
  /** English title recorded with the change, the fallback. */
  title: string;
  appliedAt: Date;
  /** Applied but the live check could not confirm it (e.g. a cache). */
  unverified: boolean;
  /** The change can be undone from the dashboard. */
  undoable: boolean;
}

export interface ReportContent {
  site: ReportInput['site'];
  generatedAt: Date;
  periodStart: Date;
  periodDays: ReportPeriodDays;
  scores: ReportInput['scores'];
  wordpressHealth: ReportInput['wordpressHealth'];
  fixes: ReportFix[];
  openIssues: ReportIssueInput[];
  cspTestSince: Date | null;
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const MAX_OPEN_ISSUES = 10;

export function buildReportContent(input: ReportInput): ReportContent {
  const periodStart = new Date(input.generatedAt.getTime() - input.periodDays * 86_400_000);

  // Changes still in place that were made in the period, oldest first, as a work log reads.
  const fixes = input.changes
    .filter((change) => change.state !== 'undone' && new Date(change.appliedAt) >= periodStart)
    .sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime())
    // A grouped change (e.g. several security headers) fixed each of its findings: one row per finding.
    .flatMap((change) =>
      (change.findingIds.length > 0 ? change.findingIds : [null]).map((findingId) => ({
        findingId,
        title: change.title,
        appliedAt: new Date(change.appliedAt),
        unverified: change.state === 'unverified',
        undoable: change.undoable,
      })),
    );

  // A fixed finding is not also "still open", whatever an older scan said.
  const fixedIds = new Set(fixes.map((fix) => fix.findingId).filter(Boolean));
  const seen = new Set<string>();
  const openIssues = input.openIssues
    .filter((issue) => !fixedIds.has(issue.id) && !seen.has(issue.id) && seen.add(issue.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_OPEN_ISSUES);

  return {
    site: input.site,
    generatedAt: input.generatedAt,
    periodStart,
    periodDays: input.periodDays,
    scores: input.scores,
    wordpressHealth: input.wordpressHealth,
    fixes,
    openIssues,
    cspTestSince: input.cspTestSince,
  };
}

/** Same scale as the cockpit, so the report and the dashboard agree. */
export function scoreGrade(score: number | null | undefined): string {
  return typeof score === 'number' ? getScoreGrade(score) : '–';
}

export function reportFilename(host: string, generatedAt: Date, format: ReportFormat): string {
  const safeHost = host.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '-');
  const date = generatedAt.toISOString().slice(0, 10);
  return `${safeHost}-report-${date}.${format === 'markdown' ? 'md' : 'pdf'}`;
}
