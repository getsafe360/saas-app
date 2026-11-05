// lib/engine/contracts.ts
//
// Canonical contracts for the optimization engine. Every category (WordPress
// health, security, performance, SEO, accessibility, content) produces the
// same shapes so that scoring, fix selection, remediation and the streaming
// canvas are written once.
//
// Ground rule: deterministic collectors decide pass/fail. A check whose input
// was not observed is `unknown` — it is shown as such and excluded from
// scoring, never guessed. LLM output may explain or prioritise findings but
// never sets their status.

export const ENGINE_CATEGORIES = [
  'security',
  'performance',
  'stability',
  'seo',
  'accessibility',
  'content',
  'red-flags',
] as const;

export type EngineCategory = (typeof ENGINE_CATEGORIES)[number];

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** `unknown`: input not observed. `not-applicable`: check does not apply to this site. */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown' | 'not-applicable';

export type Confidence = 'high' | 'medium' | 'low';

/** Where the observation behind a check came from. */
export type EvidenceSource =
  | 'connector' // GetSafe 360 WordPress plugin
  | 'external-probe' // HTTP request from our servers
  | 'pagespeed'
  | 'dns'
  | 'crew'; // LLM-derived; never decides status on its own

export interface Evidence {
  source: EvidenceSource;
  /** Raw observed value shown to the user as proof, e.g. a header value. */
  observed?: string;
  checkedAt?: string;
}

export type FixAutomation = 'auto' | 'guided' | 'manual';
export type FixRisk = 'low' | 'medium' | 'high';

/** How a finding can be fixed. Resolved against the fixer registry. */
export interface FixRef {
  fixerId: string;
  automation: FixAutomation;
  risk: FixRisk;
  /** True when the fixer can restore the previous state. */
  reversible: boolean;
  /** Connector capabilities required to auto-apply. */
  requiresCapabilities?: string[];
}

export interface FindingImpact {
  scoreGain?: number;
  riskReduction?: number;
  timeSavedMs?: number;
}

export interface Finding {
  /** Stable check id, e.g. `wp-xmlrpc`, `sec-hsts`. */
  id: string;
  category: EngineCategory;
  title: string;
  status: CheckStatus;
  severity: Severity;
  confidence: Confidence;
  /** One sentence describing what was observed. */
  summary: string;
  recommendation: string;
  evidence?: Evidence;
  fix?: FixRef;
  impact?: FindingImpact;
  /** Precheck in the UI: failing/warning, critical/high, and fixable. */
  selectedByDefault: boolean;
}

export interface CategoryScore {
  category: EngineCategory;
  /** 0–100, or null when no check in this category could be evaluated. */
  score: number | null;
  /** Share of checks with a known result, 0–1. */
  coverage: number;
  counts: Record<CheckStatus, number>;
}

export interface EngineScore {
  /** Weighted over categories that have a score; null when none do. */
  overall: number | null;
  categories: Partial<Record<EngineCategory, CategoryScore>>;
  /** Share of all checks with a known result, 0–1. */
  coverage: number;
}

export interface ScoreTrend {
  previous: number;
  current: number;
  delta: number;
}
