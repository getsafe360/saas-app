// lib/security/csp/review-ai.ts
//
// Sends the reported sources (directive, origin, count, one page path: public
// resource information, no visitor data) to Claude for advice.

import 'server-only';

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, type LanguageModel } from 'ai';
import { OPUS_MODEL_ID } from '@/lib/ai/constants';
import type { CspCandidate } from './proposal';
import { buildCspReviewPrompt, cspReviewSchema, type CspReviewOutput } from './review';

const REVIEW_TIMEOUT_MS = 60_000;

export function cspReviewAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function reviewCspCandidates(params: {
  host: string;
  locale: string;
  policy: string;
  candidates: ReadonlyArray<CspCandidate>;
}): Promise<CspReviewOutput> {
  const { system, prompt } = buildCspReviewPrompt(params);
  const { object } = await generateObject({
    // Cast needed: @ai-sdk/anthropic@3 returns LanguageModelV3 while ai@5 beta types expect V2.
    model: anthropic(OPUS_MODEL_ID) as unknown as LanguageModel,
    schema: cspReviewSchema,
    system,
    prompt,
    temperature: 0,
    abortSignal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
  });
  return object;
}
