// lib/engine/fixers/types.ts
//
// A fixer turns the selected findings it handles into one typed action, knows
// how to send that action to its executor, and how to verify the result.
// Findings point at fixers through `FixRef.fixerId` (sent by the UI as the
// finding's `actionId`), so adding a fix never touches the planner/runner.

import type { SeoCrawl } from '@/lib/engine/seo/facts';
import type {
  WordPressActionRisk,
  WordPressActionType,
  WordPressConnectorActionRequest,
  WordPressDetailedVerificationResult,
  WordPressPlannedAction,
  WordPressSeoEnvironment,
  WordPressVerificationKind,
} from '@/lib/wordpress/types';

export interface FixerFindingInput {
  id: string;
  actionId?: string;
  title?: string;
  severity?: string;
  category?: string;
  automationLevel?: string;
  safetyLevel?: 'safe' | 'review' | 'sensitive';
}

export interface FixerActionTemplate {
  type: WordPressActionType;
  title: string;
  description: string;
  risk: WordPressActionRisk;
  /**
   * May run without a further confirmation once the user selected it and
   * clicked Optimize. Preselection is decided separately (engine/rules.ts).
   */
  autoApplyEligible: boolean;
  requiresApproval: boolean;
  requiredCapabilities: string[];
  verification: {
    kind: WordPressVerificationKind;
    expectation: string;
    assertions?: string[];
  };
  payload: Record<string, unknown>;
}

/** What a fixer may need beyond the findings: the latest crawl and the site's SEO setup. */
export interface FixerPlanContext {
  crawl?: SeoCrawl | null;
  seo?: WordPressSeoEnvironment | null;
}

export interface FixerVerifyContext {
  siteUrl: string;
  tokenHash: string;
  action: WordPressPlannedAction;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
}

export interface ConnectorFixer {
  id: string;
  executor: 'wp-connector';
  /** Build one action for every selected finding this fixer handles. */
  plan(findings: ReadonlyArray<FixerFindingInput>, context?: FixerPlanContext): FixerActionTemplate | null;
  toConnectorRequest(action: WordPressPlannedAction): WordPressConnectorActionRequest | null;
  verify(context: FixerVerifyContext): Promise<WordPressDetailedVerificationResult>;
}

export type VerificationCheck = WordPressDetailedVerificationResult['checks'][number];

export function verificationResult(checks: VerificationCheck[]): WordPressDetailedVerificationResult {
  const success = checks.length > 0 && checks.every((check) => check.ok);
  return {
    success,
    checkedAt: new Date().toISOString(),
    message: success ? 'Action verified successfully.' : 'One or more verification checks did not pass.',
    checks,
  };
}
