// lib/engine/seo/report.ts
//
// The SEO/GEO check results for a crawl: findings and two scores, one for AI
// answer engines (geo-*) and one for search engines (seo-*). Computed from the
// stored crawl on every read, so improved rules apply to earlier crawls too.

import type { Finding } from '../contracts';
import { evaluateRules } from '../rules';
import { scoreCategory } from '../scoring';
import type { SeoCrawl } from './facts';
import { isGeoFinding, SEO_GEO_RULES } from './rules';

export interface SeoGeoReport {
  checkedAt: string;
  origin: string;
  pagesScanned: number;
  pageErrors: number;
  findings: Finding[];
  scores: { geo: number | null; seo: number | null };
}

export function evaluateSeoGeo(crawl: SeoCrawl): SeoGeoReport {
  const findings = evaluateRules(SEO_GEO_RULES, crawl, { checkedAt: crawl.checkedAt });
  return {
    checkedAt: crawl.checkedAt,
    origin: crawl.origin,
    pagesScanned: crawl.pages.length,
    pageErrors: crawl.pageErrors,
    findings,
    scores: {
      geo: scoreCategory('seo', findings.filter((f) => isGeoFinding(f.id))).score,
      seo: scoreCategory('seo', findings.filter((f) => !isGeoFinding(f.id))).score,
    },
  };
}
