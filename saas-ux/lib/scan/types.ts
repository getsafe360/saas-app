// lib/scan/types.ts
//
// The report shape stored in Vercel Blob under scan-results/{jobId}.json and
// consumed by AnalyzeClient. Fields present before this change are kept
// exactly as they were so the existing UI keeps working; `categoryScores`,
// `evidence` and `generatedAt` are additive.

export type ScanCategory = 'seo' | 'performance' | 'accessibility' | 'security';

export type Severity = 'low' | 'medium' | 'high';

export type ScanIssue = {
  id: string;
  category: ScanCategory;
  title: string;
  severity: Severity;
  description: string;
  suggestion: string;
  /** True only when the connector can actually perform this fix today. */
  fixAvailable: boolean;
  estTokens: number;
  /** Raw value that triggered the rule, shown to the user as proof. */
  evidence?: string;
};

export type CategoryScores = Record<ScanCategory, number>;

export type ScanReport = {
  siteUrl: string;
  generatedAt: string;
  summary: {
    score: number;
    /** Issue count per category — unchanged from the previous shape. */
    counts: Record<string, number>;
    /** Per-category 0–100 score. New: the emails and cockpit both need this. */
    categoryScores: CategoryScores;
    estTotalTokens: number;
    prose: string;
  };
  issues: ScanIssue[];
  pagesAnalyzed: string[];
  /** What the scan was able to measure, for honest empty states. */
  coverage: {
    pageSpeed: boolean;
    prose: boolean;
    cms: 'wordpress' | 'unknown';
  };
};
