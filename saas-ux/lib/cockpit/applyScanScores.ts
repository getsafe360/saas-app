// lib/cockpit/applyScanScores.ts
//
// The scan is the deeper check, so once a site has one its scores replace the quick
// analysis' estimates everywhere the cockpit shows them (hero, arcs and cards), otherwise
// the page would say "88" in the banner and "82" in the hero. Content has no scan
// counterpart and keeps the quick-analysis value.

import { getScoreGrade } from "./transform-api-data";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type { StoredScan } from "./stored";

const CATEGORIES = ["performance", "security", "seo", "accessibility"] as const;

export function applyScanScores(data: SiteCockpitResponse, scan: StoredScan | null): SiteCockpitResponse {
  if (!scan || scan.overall === undefined) return data;

  const next: SiteCockpitResponse = {
    ...data,
    summary: {
      ...data.summary,
      overallScore: scan.overall,
      grade: getScoreGrade(scan.overall),
      categoryScores: { ...data.summary.categoryScores },
    },
  };

  for (const key of CATEGORIES) {
    const score = scan.categoryScores?.[key];
    if (score === undefined) continue;
    next.summary.categoryScores[key] = score;
    next[key] = { ...next[key], score, grade: getScoreGrade(score) } as any;
  }
  return next;
}
