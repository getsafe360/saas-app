// lib/engine/rules.ts
//
// A rule turns observed facts into one check result. Rule packs are plain
// arrays of rules per category/platform; `evaluateRules` turns them into
// canonical findings.

import type {
  CheckStatus,
  Confidence,
  EngineCategory,
  EvidenceSource,
  Finding,
  FindingImpact,
  FixRef,
  Severity,
} from './contracts';

export interface RuleOutcome {
  status: CheckStatus;
  summary: string;
  /** Overrides the rule's default severity for this outcome. */
  severity?: Severity;
  confidence?: Confidence;
  observed?: string;
  /** Overrides the rule's default evidence source for this outcome. */
  source?: EvidenceSource;
  impact?: FindingImpact;
}

export interface Rule<Facts> {
  id: string;
  category: EngineCategory;
  title: string;
  severity: Severity;
  recommendation: string;
  source: EvidenceSource;
  fix?: FixRef;
  evaluate(facts: Facts): RuleOutcome;
}

export interface EvaluateContext {
  checkedAt?: string;
}

const PRESELECT_SEVERITIES: ReadonlySet<Severity> = new Set(['critical', 'high']);
const ACTIONABLE_STATUSES: ReadonlySet<CheckStatus> = new Set(['fail', 'warn']);

/**
 * Precheck rule for the fix tray: only problems we observed, that matter
 * (critical/high), and that a fixer can act on. Passing or unknown checks are
 * never preselected, whatever their severity.
 *
 * Approval gate: an automatic fix is preselected only when it is low-risk and
 * reversible. Anything else (e.g. HSTS, which browsers cache) stays available
 * but needs the user to tick it. Guided fixes change nothing on the site, so
 * preselecting them only queues instructions.
 */
export function isSelectedByDefault(finding: Pick<Finding, 'status' | 'severity' | 'fix'>): boolean {
  const { fix } = finding;
  if (!fix || fix.automation === 'manual') return false;
  if (fix.automation === 'auto' && (fix.risk !== 'low' || !fix.reversible)) return false;
  return ACTIONABLE_STATUSES.has(finding.status) && PRESELECT_SEVERITIES.has(finding.severity);
}

/** Shorthand for a check whose input was not observed. */
export function unknown(summary: string): RuleOutcome {
  return { status: 'unknown', summary, confidence: 'low' };
}

export function evaluateRules<Facts>(
  rules: ReadonlyArray<Rule<Facts>>,
  facts: Facts,
  context: EvaluateContext = {},
): Finding[] {
  return rules.map((rule) => {
    let outcome: RuleOutcome;
    try {
      outcome = rule.evaluate(facts);
    } catch {
      // A broken rule must never take down the report or invent a result.
      outcome = unknown('This check could not be evaluated.');
    }

    const finding: Finding = {
      id: rule.id,
      category: rule.category,
      title: rule.title,
      status: outcome.status,
      severity: outcome.severity ?? rule.severity,
      confidence: outcome.confidence ?? (outcome.status === 'unknown' ? 'low' : 'high'),
      summary: outcome.summary,
      recommendation: rule.recommendation,
      evidence:
        outcome.status === 'unknown'
          ? undefined
          : {
              source: outcome.source ?? rule.source,
              observed: outcome.observed,
              checkedAt: context.checkedAt,
            },
      fix: rule.fix,
      impact: ACTIONABLE_STATUSES.has(outcome.status) ? outcome.impact : undefined,
      selectedByDefault: false,
    };
    finding.selectedByDefault = isSelectedByDefault(finding);
    return finding;
  });
}
