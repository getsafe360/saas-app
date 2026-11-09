// lib/wordpress/core-review-ai.ts
//
// Asks Claude to explain changed WordPress core files. The changed lines are
// sent for this request only and not stored (privacy decision, Nov 2026).

import 'server-only';

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, type LanguageModel } from 'ai';
import { OPUS_MODEL_ID } from '@/lib/ai/constants';
import type { WordPressCoreFileDiff } from './core-files';
import { buildCoreReviewPrompt, coreReviewSchema, type CoreReviewModelOutput } from './core-review';

const REVIEW_TIMEOUT_MS = 90_000;

export function coreReviewAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function reviewCoreDiffs(params: {
  version: string;
  locale: string;
  diffs: ReadonlyArray<WordPressCoreFileDiff>;
}): Promise<CoreReviewModelOutput> {
  const files = params.diffs.filter((diff) => diff.kind !== 'unchanged');
  if (files.length === 0) return { files: [] };
  const { system, prompt } = buildCoreReviewPrompt({ version: params.version, locale: params.locale, files });
  const { object } = await generateObject({
    // Cast needed: @ai-sdk/anthropic@3 returns LanguageModelV3 while ai@5 beta types expect V2.
    model: anthropic(OPUS_MODEL_ID) as unknown as LanguageModel,
    schema: coreReviewSchema,
    system,
    prompt,
    temperature: 0,
    abortSignal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
  });
  return object;
}
