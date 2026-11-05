// components/site-cockpit/cards/wordpress/utils/healthEngine.ts
//
// UI helpers for the WordPress health panel. Rules, scoring and default
// selection live in lib/engine; this file only keeps the card-facing helpers.

import type { WordPressHealthFinding } from "@/types/site-cockpit";

export { evaluateWordPressHealth } from "@/lib/engine/wordpress/view";
export { buildWordPressFacts } from "@/lib/engine/wordpress/facts";

export type AnalysisDepthRecommendation = "quick" | "balanced" | "deep";

export function recommendWordPressAnalysisDepth(findings: WordPressHealthFinding[]): AnalysisDepthRecommendation {
  const actionable = findings.filter((finding) => finding.status === "fail" || finding.status === "warning");
  const unresolvedRisk = actionable.reduce((sum, finding) => sum + (finding.estimatedRiskReduction ?? 0), 0);
  const deepSignals = actionable.filter((finding) => finding.depthTier === "deep").length;

  if (unresolvedRisk > 220 || deepSignals >= 3) return "deep";
  if (unresolvedRisk > 120) return "balanced";
  return "quick";
}

export function estimateSelectedScoreGain(findings: WordPressHealthFinding[]): number {
  return findings.reduce((sum, finding) => sum + (finding.estimatedScoreGain ?? 0), 0);
}

export function estimateSelectedSavingsMs(findings: WordPressHealthFinding[]): number {
  return findings.reduce((sum, finding) => sum + (finding.estimatedTimeSavedMs ?? 0), 0);
}
