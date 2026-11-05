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
import { EMAIL_DNS_RULES, buildEmailDnsFacts, type EmailDnsFacts } from '../security/email-dns';
import { SECURITY_HEADER_RULES, buildSiteHeaderFacts, type SiteHeaderFacts } from '../security/headers';
import { scoreFindings } from '../scoring';
import { buildWordPressFacts, type WordPressFacts } from './facts';
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
  'sec-csp': 'balanced',
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

export function evaluateWordPressHealth(
  facts: WordPressFacts,
  headerFacts?: SiteHeaderFacts,
  checkedAt?: string,
  emailDnsFacts?: EmailDnsFacts,
): WordPressHealthReport {
  const context = { checkedAt: checkedAt ?? facts.observedAt ?? undefined };
  const findings = [
    ...evaluateRules(WORDPRESS_RULES, facts, context),
    // Header fixes run through the connector, so they belong in the WordPress fix tray.
    ...(headerFacts ? evaluateRules(SECURITY_HEADER_RULES, headerFacts, context) : []),
    ...(emailDnsFacts ? evaluateRules(EMAIL_DNS_RULES, emailDnsFacts, context) : []),
  ];
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

/**
 * Health report from the cockpit payload (analyze-facts response). The single
 * entry point for both the server (score history) and the card, so the stored
 * score and the displayed score are always computed the same way.
 */
export function evaluateWordPressHealthFromApiData(apiData: Record<string, any>): WordPressHealthReport {
  return evaluateWordPressHealth(
    buildWordPressFacts(apiData),
    buildSiteHeaderFacts(apiData),
    undefined,
    buildEmailDnsFacts(apiData),
  );
}
