// saas-ux/lib/api/rate-limit.ts
import "server-only";
import { getRedis } from "@/lib/api/redis";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
};

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * The previous implementation stored counters in Vercel Blob (list → fetch →
 * put on every request). That was slow, cost a Blob write per request, and
 * read-modify-write races meant two concurrent requests could both see the
 * same count. Redis INCR is atomic, so the window counter is correct under
 * concurrency and costs one round trip.
 *
 * When Upstash is not configured we fall back to a per-instance in-memory
 * counter. That is not a real distributed limit — it only bounds a single
 * serverless instance — so treat it as a development convenience and make
 * sure KV_REST_API_URL / KV_REST_API_TOKEN are set in production.
 */

type MemRecord = { count: number; resetAt: number };
const memory = new Map<string, MemRecord>();

function memoryLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memory.get(key);

  if (!existing || now > existing.resetAt) {
    const rec = { count: 1, resetAt: now + windowMs };
    memory.set(key, rec);
    // Opportunistic cleanup so the map cannot grow without bound.
    if (memory.size > 5_000) {
      for (const [k, v] of memory) if (now > v.resetAt) memory.delete(k);
    }
    return { ok: true, limit: max, remaining: max - 1, resetAt: rec.resetAt };
  }

  existing.count += 1;
  return {
    ok: existing.count <= max,
    limit: max,
    remaining: Math.max(0, max - existing.count),
    resetAt: existing.resetAt,
  };
}

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return memoryLimit(key, max, windowMs);

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  // Bucket the key by window so each window gets its own counter and expires
  // on its own — no separate reset bookkeeping needed.
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${bucket}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window — attach the TTL.
      await redis.expire(redisKey, windowSeconds);
    }
    return {
      ok: count <= max,
      limit: max,
      remaining: Math.max(0, max - count),
      resetAt: (bucket + 1) * windowMs,
    };
  } catch (err) {
    // Fail open: a Redis outage must not lock every user out of the product.
    console.error("[rate-limit] redis error, failing open", err);
    return { ok: true, limit: max, remaining: max, resetAt: Date.now() + windowMs };
  }
}

/** Best-effort client identifier for anonymous endpoints. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anon";
}

/** Standard 429 body + headers so every caller responds consistently. */
export function tooManyRequests(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      error: "rate_limited",
      message: "Too many requests. Please wait a moment and try again.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
