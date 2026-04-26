// lib/ai/constants.ts
// Client-safe AI constants — no server imports, safe to use in Client Components.

export const AGENT_NAME = "Sparky";
export const OPUS_MODEL_ID = "claude-opus-4-7";
export const OPUS_THINKING_BUDGET = 10_000;

export const ANALYSIS_TOKEN_COST = {
  free: 2_000,
  pro: 2_000,
  agent: 3_000,
  agency: 3_000,
  business: 8_000,
} as const;
