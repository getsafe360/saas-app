// lib/api/redis.ts
//
// Single place that resolves Upstash Redis credentials.
//
// The codebase historically used two different name pairs for the same
// Upstash instance: KV_REST_API_URL/KV_REST_API_TOKEN (Vercel's Upstash
// integration naming, used by lib/kv.ts and the /api/connect/* routes) and
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (used by /api/analyze and
// /api/analyze-facts). Because only the KV_* pair was ever documented in
// .env.example, the analyze routes silently ran with rate limiting disabled
// in production. Accept both, prefer the documented KV_* pair.

import { Redis } from "@upstash/redis";

export type RedisCredentials = { url: string; token: string };

export function getRedisCredentials(): RedisCredentials | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

let cached: Redis | null = null;

/**
 * Shared Upstash client, or null when Redis is not configured.
 *
 * Callers must handle the null case — every consumer degrades to a
 * fail-open or in-memory path so that a missing Upstash binding never takes
 * the whole app down.
 */
export function getRedis(): Redis | null {
  if (cached) return cached;
  const creds = getRedisCredentials();
  if (!creds) return null;
  cached = new Redis({ url: creds.url, token: creds.token });
  return cached;
}

/** True when Upstash is configured — useful for health checks and warnings. */
export function hasRedis(): boolean {
  return getRedisCredentials() !== null;
}
