// lib/optimization/loops/scoring.ts
// Extract category score from a scan snapshot

import type { SiteSnapshot } from './types';

export function getCategoryScore(snapshot: SiteSnapshot, category: string): number {
  const scores = snapshot.scores ?? {};

  // Direct key match
  if (typeof scores[category] === 'number') return scores[category];

  // Aliases
  const aliases: Record<string, string[]> = {
    seo: ['seo', 'seo_geo', 'seoGeo', 'seo_score'],
    performance: ['performance', 'perf', 'performance_score'],
    security: ['security', 'security_score'],
    accessibility: ['accessibility', 'a11y', 'accessibility_score'],
    content: ['content', 'content_score'],
    wordpress: ['wordpress', 'cms', 'wordpress_score'],
  };

  for (const alias of aliases[category] ?? []) {
    if (typeof scores[alias] === 'number') return scores[alias];
  }

  return 0;
}
