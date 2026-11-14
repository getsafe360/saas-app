// lib/ai-visibility/store.ts
// Tracked questions and visibility runs per site, in Redis for a year.

import 'server-only';

import { getRedis } from '@/lib/api/redis';
import type { QuestionSet, VisibilityRun } from './types';

const TTL_SECONDS = 365 * 24 * 60 * 60;
const RUNS = 26; // half a year of weekly runs
const LOCK_SECONDS = 300;

const questionsKey = (siteId: string) => `ai-vis:${siteId}:questions`;
const runsKey = (siteId: string) => `ai-vis:${siteId}:runs`;
const lockKey = (siteId: string) => `ai-vis:${siteId}:lock`;
const trialKey = (teamId: number) => `ai-vis:team:${teamId}:trial`;
const TRACKED_SITES = 'ai-vis:sites';

function parse<T>(raw: T | string | null): T | null {
  if (raw === null || raw === undefined) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as T) : raw;
}

export async function loadQuestions(siteId: string): Promise<QuestionSet | null> {
  const redis = getRedis();
  if (!redis) return null;
  return parse(await redis.get<QuestionSet | string>(questionsKey(siteId)));
}

export async function saveQuestions(siteId: string, set: QuestionSet): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('Storage is not configured');
  const pipeline = redis.pipeline().set(questionsKey(siteId), JSON.stringify(set), { ex: TTL_SECONDS });
  if (set.questions.length > 0) pipeline.sadd(TRACKED_SITES, siteId);
  else pipeline.srem(TRACKED_SITES, siteId);
  await pipeline.exec();
}

export async function loadRuns(siteId: string, count = RUNS): Promise<VisibilityRun[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = await redis.lrange<VisibilityRun | string>(runsKey(siteId), 0, count - 1);
  return raw.map((item) => parse(item)).filter((run): run is VisibilityRun => run !== null);
}

export async function saveRun(siteId: string, run: VisibilityRun): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis
    .pipeline()
    .lpush(runsKey(siteId), JSON.stringify(run))
    .ltrim(runsKey(siteId), 0, RUNS - 1)
    .expire(runsKey(siteId), TTL_SECONDS)
    .exec();
}

/** One run per site at a time. False when one is already running. */
export async function acquireRunLock(siteId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  return (await redis.set(lockKey(siteId), '1', { nx: true, ex: LOCK_SECONDS })) === 'OK';
}

export async function releaseRunLock(siteId: string): Promise<void> {
  await getRedis()?.del(lockKey(siteId));
}

export async function trialUsed(teamId: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  return (await redis.exists(trialKey(teamId))) === 1;
}

/** Claims the free trial run for the team. False when it was already used. */
export async function claimTrial(teamId: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  return (await redis.set(trialKey(teamId), new Date().toISOString(), { nx: true })) === 'OK';
}

export async function releaseTrial(teamId: number): Promise<void> {
  await getRedis()?.del(trialKey(teamId));
}

export async function trackedSiteIds(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  return redis.smembers(TRACKED_SITES);
}
