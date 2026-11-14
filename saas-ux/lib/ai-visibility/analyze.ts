// lib/ai-visibility/analyze.ts
// Reads one Claude answer (Messages API content blocks, web search on) and
// measures what it shows about the site: named in the text, cited as a source,
// found by the searches. Pure: no I/O here.

import type { QuestionResult, TrackedQuestion, VisibilityRun } from './types';

/** The parts of a Messages API content block this reads. */
export interface AnswerBlock {
  type: string;
  text?: string;
  citations?: Array<{ type?: string; url?: string; title?: string }> | null;
  content?: unknown;
}

const EXCERPT_CHARS = 280;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** The site's host or one of its subdomains. */
export function isSiteHost(host: string | null, siteHost: string): boolean {
  if (!host) return false;
  const site = siteHost.toLowerCase().replace(/^www\./, '');
  return host === site || host.endsWith(`.${site}`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A brand term as a whole word (or domain), case-insensitive. */
function mentionPattern(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('\n', index), text.lastIndexOf('. ', index) + 1, 0);
  const sentence = text.slice(start, start + EXCERPT_CHARS * 2).trim();
  return sentence.length > EXCERPT_CHARS ? `${sentence.slice(0, EXCERPT_CHARS - 1).trimEnd()}…` : sentence;
}

export function analyzeAnswer(params: {
  question: TrackedQuestion;
  blocks: ReadonlyArray<AnswerBlock>;
  siteHost: string;
  brands: string[];
  searches: number;
}): QuestionResult {
  const { question, blocks, siteHost, brands } = params;
  const text = blocks.filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');

  const citedHosts = new Map<string, number>();
  const citedSiteUrls = new Set<string>();
  for (const block of blocks) {
    for (const citation of block.citations ?? []) {
      if (!citation?.url) continue;
      const host = hostOf(citation.url);
      if (!host) continue;
      if (isSiteHost(host, siteHost)) citedSiteUrls.add(citation.url);
      else citedHosts.set(host, (citedHosts.get(host) ?? 0) + 1);
    }
  }

  let foundInSearch = false;
  for (const block of blocks) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const result of block.content as Array<{ url?: unknown }>) {
      if (typeof result?.url === 'string' && isSiteHost(hostOf(result.url), siteHost)) foundInSearch = true;
    }
  }

  let mentionAt = -1;
  for (const term of brands) {
    const match = mentionPattern(term).exec(text);
    if (match && (mentionAt < 0 || match.index < mentionAt)) mentionAt = match.index;
  }
  const cited = citedSiteUrls.size > 0;

  return {
    questionId: question.id,
    question: question.text,
    mentioned: mentionAt >= 0 || cited,
    cited,
    foundInSearch: foundInSearch || cited,
    citedUrls: [...citedSiteUrls].slice(0, 5),
    otherSources: [...citedHosts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([host, count]) => ({ host, count })),
    excerpt: text ? sentenceAround(text, Math.max(0, mentionAt)) : '',
    searches: params.searches,
  };
}

/** 0–100 over the questions that got an answer: a citation counts fully, a mention without one half. */
export function visibilityScore(results: ReadonlyArray<QuestionResult>): number {
  const answered = results.filter((result) => !result.error);
  if (answered.length === 0) return 0;
  const points = answered.reduce((sum, result) => sum + (result.cited ? 1 : result.mentioned ? 0.5 : 0), 0);
  return Math.round((points / answered.length) * 100);
}

/** Other sites cited most across a run: who the AI recommends instead. */
export function topCompetitors(run: Pick<VisibilityRun, 'results'>, limit = 5): Array<{ host: string; questions: number }> {
  const counts = new Map<string, number>();
  for (const result of run.results) {
    for (const source of result.otherSources) counts.set(source.host, (counts.get(source.host) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([host, questions]) => ({ host, questions }));
}
