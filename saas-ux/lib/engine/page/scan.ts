// lib/engine/page/scan.ts
//
// The site scan's view of the page checks: failing findings in the stored
// ScanIssue shape (unchanged, so existing reports, the fix planner and the
// emails keep working) and a rule score per scan category.

import type { Finding } from '../contracts';
import { evaluateRules } from '../rules';
import { scoreCategory } from '../scoring';
import type { CategoryScores, ScanCategory, ScanIssue } from '@/lib/scan/types';
import { buildPageFacts } from './facts';
import { PAGE_SCAN_RULES } from './rules';

export const SCAN_CATEGORIES: ReadonlyArray<ScanCategory> = ['seo', 'performance', 'accessibility', 'security'];

/** Fixes the paid fix flow can actually perform (see lib/fix/planner.ts). */
const FIXABLE: Readonly<Record<string, { estTokens: number }>> = {
  'seo-schema-missing': { estTokens: 900 },
  'sec-wp-xmlrpc': { estTokens: 400 },
  'sec-wp-user-enum': { estTokens: 400 },
};

export function toScanIssue(finding: Finding): ScanIssue {
  const fix = FIXABLE[finding.id];
  return {
    id: finding.id,
    category: finding.category as ScanCategory,
    title: finding.title,
    // The scan's scale has no "critical"; it is its most severe level.
    severity: finding.severity === 'critical' ? 'high' : finding.severity,
    description: finding.summary,
    suggestion: finding.recommendation,
    fixAvailable: Boolean(fix),
    estTokens: fix?.estTokens ?? 0,
    evidence: finding.evidence?.observed,
  };
}

export interface PageScanResult {
  findings: Finding[];
  issues: ScanIssue[];
  /** Rule score per category; null when nothing in it could be observed. */
  ruleScores: Record<ScanCategory, number | null>;
}

export function evaluatePageScan(pre: unknown, requested: ReadonlySet<ScanCategory> = new Set(SCAN_CATEGORIES)): PageScanResult {
  const rules = PAGE_SCAN_RULES.filter((rule) => requested.has(rule.category as ScanCategory));
  const findings = evaluateRules(rules, buildPageFacts(pre as Record<string, unknown>));
  const issues = findings.filter((f) => f.status === 'fail' || f.status === 'warn').map(toScanIssue);

  const ruleScores = {} as Record<ScanCategory, number | null>;
  for (const category of SCAN_CATEGORIES) {
    ruleScores[category] = scoreCategory(
      category,
      findings.filter((f) => f.category === category),
    ).score;
  }
  return { findings, issues, ruleScores };
}

/**
 * Lighthouse is the better measurement for performance, SEO and accessibility
 * (it loads the page); our checks cover security, which Lighthouse does not
 * score, and catch things it ignores. Weighting Lighthouse at 60% keeps the
 * number recognisable to anyone who also runs PageSpeed Insights.
 */
export function blendCategoryScores(
  ruleScores: Record<ScanCategory, number | null>,
  lighthouse: Partial<Record<ScanCategory, number>> | null | undefined,
): CategoryScores {
  const scores = {} as CategoryScores;
  for (const category of SCAN_CATEGORIES) {
    const fromRules = ruleScores[category];
    const fromLighthouse = category === 'security' ? undefined : lighthouse?.[category];
    if (typeof fromLighthouse === 'number') {
      scores[category] = fromRules === null ? fromLighthouse : Math.round(fromLighthouse * 0.6 + fromRules * 0.4);
    } else {
      // No check in the category could observe anything and there is no
      // Lighthouse value: nothing was found wrong, as the scan always reported.
      scores[category] = fromRules ?? 100;
    }
  }
  return scores;
}
