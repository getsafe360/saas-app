// lib/engine/page/view.ts
//
// Cockpit card scores and check counts from the page checks — the same checks
// the site scan runs, so a card's issue list matches its score.

import type { Finding, FindingMessages } from '../contracts';
import { evaluateRules } from '../rules';
import { scoreCategory } from '../scoring';
import { buildPageFacts } from './facts';
import { PAGE_RULES } from './rules';
import { SCAN_CATEGORIES, blendCategoryScores } from './scan';

export type PageCardCategory = 'performance' | 'security' | 'seo' | 'accessibility' | 'content';

const CARD_CATEGORIES: ReadonlyArray<PageCardCategory> = ['performance', 'security', 'seo', 'accessibility', 'content'];

export interface PageCardInsights {
  criticalIssues: number;
  warnings: number;
  passed: number;
  /** English titles of the top problems, most severe first (kept for older callers). */
  topIssues: string[];
  /** The same problems with their message keys, so the card can translate them. */
  topFindings: Array<{ id: string; title: string; critical: boolean; messages?: FindingMessages }>;
  /** Ids of every failing or warning check, most severe first. */
  problemIds: string[];
}

export interface PageCardReport {
  findings: Finding[];
  scores: Record<PageCardCategory, number>;
  insights: Record<PageCardCategory, PageCardInsights>;
  /** Average of the four scan categories, exactly as the site scan computes it. */
  overall: number;
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const isCritical = (finding: Finding) =>
  finding.status === 'fail' && (finding.severity === 'critical' || finding.severity === 'high');

function insightsFor(findings: Finding[]): PageCardInsights {
  const problems = findings
    .filter((f) => f.status === 'fail' || f.status === 'warn')
    .sort((a, b) => Number(isCritical(b)) - Number(isCritical(a)) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const top = problems.slice(0, 3);
  return {
    criticalIssues: problems.filter(isCritical).length,
    warnings: problems.filter((f) => !isCritical(f)).length,
    passed: findings.filter((f) => f.status === 'pass').length,
    topIssues: top.map((f) => f.title),
    topFindings: top.map((f) => ({ id: f.id, title: f.title, critical: isCritical(f), messages: f.messages })),
    problemIds: problems.map((f) => f.id),
  };
}

export function evaluatePageCards(apiData: unknown): PageCardReport {
  const findings = evaluateRules(PAGE_RULES, buildPageFacts(apiData as Record<string, unknown>));
  const byCategory = (category: PageCardCategory) => findings.filter((f) => f.category === category);

  const ruleScores = Object.fromEntries(
    SCAN_CATEGORIES.map((category) => [category, scoreCategory(category, byCategory(category)).score]),
  ) as Parameters<typeof blendCategoryScores>[0];
  // No Lighthouse in the quick analysis; a later scan blends it in.
  const scan = blendCategoryScores(ruleScores, null);

  const scores: Record<PageCardCategory, number> = {
    ...scan,
    content: scoreCategory('content', byCategory('content')).score ?? 100,
  };
  const insights = Object.fromEntries(
    CARD_CATEGORIES.map((category) => [category, insightsFor(byCategory(category))]),
  ) as Record<PageCardCategory, PageCardInsights>;

  const overall = Math.round(SCAN_CATEGORIES.reduce((sum, c) => sum + scan[c], 0) / SCAN_CATEGORIES.length);
  return { findings, scores, insights, overall };
}
