// lib/cockpit/stored.ts
//
// What the cockpit already knows about a site before it re-analyzes it: the numbers saved
// in sites.last_scores by earlier visits, plus a snapshot of the latest scan. Pure and
// defensive: last_scores is free-form JSON, so every field is checked.

export interface StoredScores {
  overall: number;
  performance?: number;
  security?: number;
  seo?: number;
  accessibility?: number;
  content?: number;
}

export interface StoredCounts {
  passed: number;
  warnings: number;
  critical: number;
}

export interface StoredScan {
  jobId: string;
  at: string;
  /** The scan's own overall score, when it saved one. */
  overall?: number;
  categoryScores?: Partial<Record<"performance" | "security" | "seo" | "accessibility", number>>;
  issueCount: number;
  fixableCount: number;
}

export interface StoredSiteState {
  scores: StoredScores | null;
  counts: StoredCounts | null;
  pageTitle: string | null;
  /** ISO time of the last quick analysis that saved these scores. */
  checkedAt: string | null;
  /** Latest finished scan, or null if the site was never scanned. */
  scan: StoredScan | null;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function parseStoredSite(lastScores: unknown): StoredSiteState {
  const raw = (lastScores && typeof lastScores === "object" ? lastScores : {}) as Record<string, any>;

  const overall = num(raw.overall);
  const scores: StoredScores | null =
    overall === undefined
      ? null
      : {
          overall,
          performance: num(raw.performance),
          security: num(raw.security),
          seo: num(raw.seo),
          accessibility: num(raw.accessibility),
          content: num(raw.content),
        };

  const c = raw.counts;
  const counts: StoredCounts | null =
    c && num(c.passed) !== undefined && num(c.warnings) !== undefined && num(c.critical) !== undefined
      ? { passed: c.passed, warnings: c.warnings, critical: c.critical }
      : null;

  const s = raw.scan;
  const scan: StoredScan | null =
    s && typeof s.jobId === "string" && typeof s.at === "string" && num(s.issueCount) !== undefined
      ? {
          jobId: s.jobId,
          at: s.at,
          overall: num(s.overall),
          categoryScores: {
            performance: num(s.categoryScores?.performance),
            security: num(s.categoryScores?.security),
            seo: num(s.categoryScores?.seo),
            accessibility: num(s.categoryScores?.accessibility),
          },
          issueCount: s.issueCount,
          fixableCount: num(s.fixableCount) ?? 0,
        }
      : null;

  return {
    scores,
    counts,
    pageTitle: typeof raw.pageTitle === "string" && raw.pageTitle ? raw.pageTitle : null,
    checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : null,
    scan,
  };
}
