// lib/ai-visibility/config.ts
// Limits and prices of AI visibility tracking. Client-safe (no server imports).

import type { PlanName } from '@/lib/plans/config';

/** Model that answers the tracked questions: the same Claude a visitor would ask, with web search. */
export const VISIBILITY_MODEL_ID = 'claude-sonnet-5-5';
/** Searches Claude may run per question ($10 per 1,000 searches on the Claude API). */
export const SEARCHES_PER_QUESTION = 2;
export const ANSWER_MAX_TOKENS = 900;
/** Searches are billed in money, not tokens: one search is charged like this many tokens (~$0.01). */
export const TOKENS_PER_SEARCH = 500;

/** Questions a site may track per plan. Free gets one trial run of its first questions. */
export const QUESTION_LIMIT: Record<PlanName, number> = {
  free: 3,
  pro: 5,
  agent: 10,
  agency: 10,
  business: 10,
};

/** Paid plans are re-checked automatically every week; free gets a single trial run. */
export const WEEKLY_PLANS: ReadonlySet<PlanName> = new Set(['pro', 'agent', 'agency', 'business']);
export const RECHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const QUESTION_MIN_CHARS = 8;
export const QUESTION_MAX_CHARS = 160;

/**
 * "Check now" draws tokens at what it costs, in the same unit as AI fixes (~2,000 tokens ≈ $0.04, so 50,000 per $1).
 * Claude Sonnet: $3 per million input tokens, $15 per million output tokens; search $0.01. Update with pricing.
 */
export const TOKENS_PER_INPUT_TOKEN = 0.15;
export const TOKENS_PER_OUTPUT_TOKEN = 0.75;
/** Reserved per question before a manual check starts. */
export const ESTIMATED_TOKENS_PER_QUESTION = 3_000;

export function chargeFor(usage: { inputTokens: number; outputTokens: number; searches: number }): number {
  return Math.ceil(
    usage.inputTokens * TOKENS_PER_INPUT_TOKEN + usage.outputTokens * TOKENS_PER_OUTPUT_TOKEN + usage.searches * TOKENS_PER_SEARCH,
  );
}
