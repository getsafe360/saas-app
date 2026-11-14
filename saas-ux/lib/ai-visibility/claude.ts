// lib/ai-visibility/claude.ts
// The Claude calls of AI visibility tracking, straight on the Messages API so
// the web search blocks and citations arrive exactly as Anthropic sends them.

import 'server-only';

import type { AnswerBlock } from './analyze';
import { ANSWER_MAX_TOKENS, SEARCHES_PER_QUESTION, VISIBILITY_MODEL_ID } from './config';
import { languageName } from './questions';

const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 90_000;

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

interface MessagesResponse {
  content: AnswerBlock[];
  stop_reason: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
}

export function hasVisibilityKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function createMessage(body: Record<string, unknown>): Promise<MessagesResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Claude API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as MessagesResponse;
}

function addUsage(total: ClaudeUsage, usage: MessagesResponse['usage']): void {
  total.inputTokens += (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  total.outputTokens += usage?.output_tokens ?? 0;
  total.searches += usage?.server_tool_use?.web_search_requests ?? 0;
}

/**
 * Asks Claude the question the way a visitor would, with web search on. The
 * prompt never names the site: whether Claude finds and cites it is the measurement.
 */
export async function askWithSearch(question: string, language: string): Promise<{ blocks: AnswerBlock[]; usage: ClaudeUsage }> {
  const usage: ClaudeUsage = { inputTokens: 0, outputTokens: 0, searches: 0 };
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [{ role: 'user', content: question }];
  const blocks: AnswerBlock[] = [];
  // A long search turn can pause; continuing it twice is plenty for two searches.
  for (let turn = 0; turn < 3; turn++) {
    const response = await createMessage({
      model: VISIBILITY_MODEL_ID,
      max_tokens: ANSWER_MAX_TOKENS,
      system: `Answer as a helpful assistant, in ${languageName(language)}. Search the web when it helps, and name specific businesses, products or websites where the question asks for recommendations.`,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: SEARCHES_PER_QUESTION }],
    });
    addUsage(usage, response.usage);
    blocks.push(...response.content);
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  return { blocks, usage };
}

/** Claude's suggested questions (raw reply text) for the site described in the prompt. */
export async function suggestQuestionsText(prompt: { system: string; user: string }): Promise<{ text: string; usage: ClaudeUsage }> {
  const usage: ClaudeUsage = { inputTokens: 0, outputTokens: 0, searches: 0 };
  const response = await createMessage({
    model: VISIBILITY_MODEL_ID,
    max_tokens: 800,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  addUsage(usage, response.usage);
  const text = response.content.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('');
  return { text, usage };
}
