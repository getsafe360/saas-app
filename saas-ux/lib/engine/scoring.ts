// lib/engine/scoring.ts
//
// Category and overall scores. Unknown and not-applicable checks are excluded:
// a category with nothing observed has no score rather than a made-up one, and
// overall weights are renormalised across the categories that do.

import type {
  CategoryScore,
  CheckStatus,
  EngineCategory,
  EngineScore,
  Finding,
  ScoreTrend,
  Severity,
} from './contracts';

export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 4,
};

export type CategoryWeights = Partial<Record<EngineCategory, number>>;

function emptyCounts(): Record<CheckStatus, number> {
  return { pass: 0, warn: 0, fail: 0, unknown: 0, 'not-applicable': 0 };
}

export function scoreCategory(category: EngineCategory, findings: ReadonlyArray<Finding>): CategoryScore {
  const counts = emptyCounts();
  let penalty = 0;

  for (const finding of findings) {
    counts[finding.status] += 1;
    if (finding.status === 'fail') penalty += SEVERITY_PENALTY[finding.severity];
    if (finding.status === 'warn') penalty += Math.round(SEVERITY_PENALTY[finding.severity] / 2);
  }

  const applicable = findings.length - counts['not-applicable'];
  const known = counts.pass + counts.warn + counts.fail;

  return {
    category,
    score: known === 0 ? null : Math.max(0, Math.min(100, 100 - penalty)),
    coverage: applicable === 0 ? 0 : known / applicable,
    counts,
  };
}

export function scoreFindings(findings: ReadonlyArray<Finding>, weights: CategoryWeights): EngineScore {
  const byCategory = new Map<EngineCategory, Finding[]>();
  for (const finding of findings) {
    const bucket = byCategory.get(finding.category) ?? [];
    bucket.push(finding);
    byCategory.set(finding.category, bucket);
  }

  const categories: EngineScore['categories'] = {};
  let weightedSum = 0;
  let weightTotal = 0;
  let known = 0;
  let applicable = 0;

  for (const [category, categoryFindings] of byCategory) {
    const result = scoreCategory(category, categoryFindings);
    categories[category] = result;

    known += result.counts.pass + result.counts.warn + result.counts.fail;
    applicable += categoryFindings.length - result.counts['not-applicable'];

    const weight = weights[category] ?? 0;
    if (result.score !== null && weight > 0) {
      weightedSum += result.score * weight;
      weightTotal += weight;
    }
  }

  return {
    overall: weightTotal === 0 ? null : Math.round(weightedSum / weightTotal),
    categories,
    coverage: applicable === 0 ? 0 : known / applicable,
  };
}

/** A trend exists only when a real previous score was recorded. */
export function computeTrend(previous: number | null | undefined, current: number | null): ScoreTrend | undefined {
  if (typeof previous !== 'number' || current === null) return undefined;
  return { previous, current, delta: current - previous };
}
