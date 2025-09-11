// saas-ux/lib/api/rate-limit.ts
import "server-only";
import { list, put } from "@vercel/blob";
import crypto from "crypto";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number; // epoch ms
};

type RLRecord = {
  key: string;
  windowMs: number;
  max: number;
  count: number;
  resetAt: number;
};

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const id = hash(key);
  const blobKey = `ratelimits/${id}.json`;

  let rec: RLRecord | null = null;

  // Try to read existing window
  const { blobs } = await list({ prefix: blobKey });
  const b = blobs[0];
  if (b) {
    const r = await fetch(b.url, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json().catch(() => null)) as Partial<RLRecord> | null;
      // validate minimal shape
      if (
        j &&
        typeof j.resetAt === "number" &&
        typeof j.count === "number" &&
        typeof j.max === "number" &&
        typeof j.windowMs === "number"
      ) {
        rec = {
          key,
          windowMs: j.windowMs,
          max: j.max,
          count: j.count,
          resetAt: j.resetAt,
        };
      }
    }
  }

  const now = Date.now();

  // New window or increment (narrowed branches to satisfy TS)
  if (!rec) {
    rec = { key, windowMs, max, count: 1, resetAt: now + windowMs };
  } else if (now > rec.resetAt) {
    rec = { key, windowMs, max, count: 1, resetAt: now + windowMs };
  } else {
    rec.count = (rec.count || 0) + 1;
  }

  await put(blobKey, JSON.stringify(rec), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });

  const remaining = Math.max(0, rec.max - rec.count);
  return { ok: rec.count <= rec.max, remaining, resetAt: rec.resetAt };
}

function hash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 24);
}
