// lib/ai-visibility/service.ts
// Runs AI visibility checks: asks Claude every tracked question with web search,
// measures each answer and stores the run. Shared by "Check now" and the weekly job.

import 'server-only';

import { and, eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { teamMembers, teams } from '@/lib/db/schema/auth/teams';
import { isPlanName, type PlanName } from '@/lib/plans/config';
import type { SeoCrawl } from '@/lib/engine/seo/facts';
import { evaluateSeoGeo } from '@/lib/engine/seo/report';
import { crawlSite } from '@/lib/seo/crawl';
import { loadCrawl, saveCrawl } from '@/lib/seo/store';
import { analyzeAnswer, failedResult, visibilityScore } from './analyze';
import { askWithSearch, suggestQuestionsText } from './claude';
import { chargeFor, QUESTION_LIMIT } from './config';
import { brandTerms, buildSuggestPrompt, normalizeQuestions, parseSuggested } from './questions';
import { saveRun } from './store';
import type { QuestionResult, TrackedQuestion, VisibilityRun } from './types';

const CONCURRENCY = 3;
const CRAWL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SiteContext {
  siteId: string;
  siteUrl: string;
  teamId: number | null;
  plan: PlanName;
}

async function teamFor(userId: number): Promise<{ teamId: number | null; plan: PlanName }> {
  const db = getDrizzle();
  const [row] = await db
    .select({ id: teams.id, planName: teams.planName })
    .from(teams)
    .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return { teamId: row?.id ?? null, plan: isPlanName(row?.planName) ? row.planName : 'free' };
}

/** The signed-in user's site, with the team that pays for it. Null when it is not theirs. */
export async function siteForUser(clerkUserId: string, siteId: string): Promise<SiteContext | null> {
  const db = getDrizzle();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!user) return null;
  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, user.id)))
    .limit(1);
  if (!site) return null;
  return { siteId: site.id, siteUrl: site.siteUrl, ...(await teamFor(user.id)) };
}

/** A site and its owner's team, for the weekly job. */
export async function siteById(siteId: string): Promise<SiteContext | null> {
  const db = getDrizzle();
  const [site] = await db.select({ id: sites.id, siteUrl: sites.siteUrl, userId: sites.userId }).from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return null;
  return { siteId: site.id, siteUrl: site.siteUrl, ...(await teamFor(site.userId)) };
}

/** The latest crawl, or a fresh one when it is missing or older than a week. */
export async function crawlFor(site: SiteContext): Promise<SeoCrawl | null> {
  const cached = await loadCrawl(site.siteId).catch(() => null);
  if (cached && Date.now() - Date.parse(cached.checkedAt) < CRAWL_MAX_AGE_MS) return cached;
  const crawl = await crawlSite(site.siteUrl).catch(() => null);
  if (!crawl || crawl.pages.length === 0) return cached;
  const { scores } = evaluateSeoGeo(crawl);
  await saveCrawl(site.siteId, crawl, scores).catch(() => undefined);
  return crawl;
}

export async function suggestQuestions(crawl: SeoCrawl, language: string, plan: PlanName): Promise<{ questions: TrackedQuestion[]; tokens: number }> {
  const { text, usage } = await suggestQuestionsText(buildSuggestPrompt(crawl, language));
  return { questions: normalizeQuestions(parseSuggested(text), QUESTION_LIMIT[plan], brandTerms(crawl)), tokens: chargeFor(usage) };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  }));
  return out;
}

/** Asks every question and stores the run. A question whose answer fails is kept, marked, and not scored. */
export async function runVisibility(params: {
  site: SiteContext;
  crawl: SeoCrawl;
  questions: TrackedQuestion[];
  language: string;
  trigger: VisibilityRun['trigger'];
}): Promise<VisibilityRun> {
  const siteHost = new URL(params.crawl.origin).hostname;
  const brands = brandTerms(params.crawl);
  let tokensUsed = 0;
  const results = await mapLimit(params.questions, CONCURRENCY, async (question): Promise<QuestionResult> => {
    try {
      const { blocks, usage } = await askWithSearch(question.text, params.language);
      tokensUsed += chargeFor(usage);
      return analyzeAnswer({ question, blocks, siteHost, brands, searches: usage.searches });
    } catch {
      return failedResult(question);
    }
  });
  const run: VisibilityRun = {
    checkedAt: new Date().toISOString(),
    trigger: params.trigger,
    score: visibilityScore(results),
    results,
    tokensUsed,
  };
  if (results.some((result) => !result.error)) await saveRun(params.site.siteId, run);
  return run;
}
