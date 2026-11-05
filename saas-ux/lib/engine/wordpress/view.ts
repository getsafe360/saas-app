// lib/engine/wordpress/view.ts
//
// Adapts canonical engine results to the WordPress cockpit card's view types,
// so the card keeps working while everything upstream runs on the engine.

import type {
  WordPressCategoryScores,
  WordPressHealthCategory,
  WordPressHealthFinding,
} from '@/types/site-cockpit';
import type { EngineCategory, EngineScore, Finding, FixRisk } from '../contracts';
import { evaluateRules } from '../rules';
import { scoreFindings } from '../scoring';
import type { WordPressFacts } from './facts';
import { WORDPRESS_CATEGORY_WEIGHTS, WORDPRESS_RULES } from './rules';

const VIEW_CATEGORY: Record<EngineCategory, WordPressHealthCategory> = {
  security: 'security',
  performance: 'performance',
  stability: 'stability',
  seo: 'seo-ux',
  accessibility: 'seo-ux',
  content: 'seo-ux',
  'red-flags': 'red-flags',
};

const SAFETY_LEVEL: Record<FixRisk, NonNullable<WordPressHealthFinding['safetyLevel']>> = {
  low: 'safe',
  medium: 'review',
  high: 'sensitive',
};

const DEPTH_TIER: Record<string, NonNullable<WordPressHealthFinding['depthTier']>> = {
  'wp-login-exposed': 'balanced',
  'wp-outdated-plugins': 'balanced',
  'seo-sitemap': 'balanced',
  'red-flag-hidden-plugins': 'deep',
  'red-flag-core-modifications': 'deep',
};

export function toWordPressHealthFinding(finding: Finding): WordPressHealthFinding {
  return {
    id: finding.id,
    category: VIEW_CATEGORY[finding.category],
    title: finding.title,
    description: finding.summary,
    severity: finding.severity,
    checkedByDefault: finding.selectedByDefault,
    status:
      finding.status === 'warn'
        ? 'warning'
        : finding.status === 'not-applicable'
          ? 'pass'
          : finding.status,
    confidence: finding.confidence,
    evidence: finding.evidence,
    action: finding.recommendation,
    remediationActionId: finding.fix?.fixerId,
    automationLevel: finding.fix?.automation,
    estimatedScoreGain: finding.impact?.scoreGain,
    estimatedTimeSavedMs: finding.impact?.timeSavedMs,
    estimatedRiskReduction: finding.impact?.riskReduction,
    depthTier: DEPTH_TIER[finding.id] ?? 'quick',
    safetyLevel: finding.fix ? SAFETY_LEVEL[finding.fix.risk] : undefined,
  };
}

export function toWordPressCategoryScores(score: EngineScore): WordPressCategoryScores {
  const pick = (category: EngineCategory) => score.categories[category]?.score ?? null;
  const seo = pick('seo');
  const accessibility = pick('accessibility');
  const seoUx =
    seo === null && accessibility === null
      ? null
      : Math.round(((seo ?? 0) + (accessibility ?? 0)) / ((seo === null ? 0 : 1) + (accessibility === null ? 0 : 1)));

  return {
    security: pick('security'),
    performance: pick('performance'),
    stability: pick('stability'),
    'seo-ux': seoUx,
    'red-flags': pick('red-flags'),
  };
}

export interface WordPressHealthReport {
  findings: Finding[];
  score: EngineScore;
  view: {
    findings: WordPressHealthFinding[];
    categoryScores: WordPressCategoryScores;
  };
}

export function evaluateWordPressHealth(facts: WordPressFacts, checkedAt?: string): WordPressHealthReport {
  const findings = evaluateRules(WORDPRESS_RULES, facts, { checkedAt: checkedAt ?? facts.observedAt ?? undefined });
  const score = scoreFindings(findings, WORDPRESS_CATEGORY_WEIGHTS);
  return {
    findings,
    score,
    view: {
      findings: findings.map(toWordPressHealthFinding),
      categoryScores: toWordPressCategoryScores(score),
    },
  };
}
