// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, or } from "drizzle-orm";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

import { getDrizzle } from "@/lib/db/postgres";
import { users } from '@/lib/db/schema/auth/users';
import { sites } from "@/lib/db/schema/sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PAIRING_TTL_SEC = 10 * 60; // 10 minutes

const redis = new Redis({
  url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
  token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
});

// --- utils ---
function normalizeInput(u: string): string {
  try {
    const url = new URL(u);
    url.search = "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === "" || url.pathname === "/") url.pathname = "/";
    return url.toString();
  } catch {
    return u;
  }
}

async function probeOnce(siteUrl: string, path: string, signal: AbortSignal) {
  const timer = new AbortController();
  const t = setTimeout(() => timer.abort(), 1500);
  // Link shared cancellation signal so a win by a sibling probe cancels this fetch
  signal.addEventListener("abort", () => { clearTimeout(t); timer.abort(); }, { once: true });
  try {
    const res = await fetch(new URL(path, siteUrl).toString(), {
      method: "GET",
      headers: { "user-agent": "GetSafe360/0.1 (+connect-probe)" },
      cache: "no-store",
      signal: timer.signal,
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const j = await res.json().catch(() => null);
    return !!(j && j.ok === true);
  } catch {
    clearTimeout(t);
    return false;
  }
}

async function probePlugin(siteUrl: string): Promise<boolean> {
  const paths = ["/wp-json/getsafe/v1/ping", "/?rest_route=/getsafe/v1/ping"];
  const urls = [siteUrl];
  try {
    const u = new URL(siteUrl);
    const flipped = new URL(siteUrl);
    flipped.protocol = u.protocol === "http:" ? "https:" : "http:";
    urls.push(flipped.toString());
  } catch { /* ignore */ }

  // Shared controller: aborted as soon as any probe succeeds so losers stop immediately
  const shared = new AbortController();
  const probes = urls.flatMap((u) =>
    paths.map((p) =>
      probeOnce(u, p, shared.signal)
        .catch(() => false)
        .then((ok) => { if (!ok) throw new Error("miss"); shared.abort(); return true; }),
    ),
  );
  return Promise.any(probes).catch(() => false);
}


async function probePluginWithDeadline(siteUrl: string, deadlineMs: number): Promise<boolean> {
  try {
    return await Promise.race([
      probePlugin(siteUrl),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), deadlineMs)),
    ]);
  } catch {
    return false;
  }
}
function sixDigitCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Atomically reserve a unique numeric code with Redis SET NX (single round-trip per attempt)
async function reserveUniquePairCode(): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const code = sixDigitCode();
    // NX = only set if key does not already exist
    const ok = await redis.set(`pairing:code:${code}`, "reserved", {
      nx: true,
      ex: PAIRING_TTL_SEC,
    });
    if (ok === "OK") return code;
  }

  throw new Error("pairing code pool temporarily exhausted");
}

// Redis-based rate limit: INCR + EXPIRE (replaces Blob-based approach)
async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<{ ok: boolean; resetAt: number }> {
  const rKey = `rl:${key}`;
  const count = await redis.incr(rKey);
  if (count === 1) await redis.expire(rKey, windowSec);
  const ttl = await redis.ttl(rKey);
  return { ok: count <= max, resetAt: Date.now() + Math.max(ttl, 0) * 1000 };
}

// --- handler ---
export async function POST(req: NextRequest) {
  try {
    return await postHandler(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[connect/start] Unhandled error:", err);

    if (message.includes("pairing code pool temporarily exhausted")) {
      return NextResponse.json(
        { error: "Pairing service busy. Please retry in a few seconds." },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Internal error → try again" }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  // 1) Auth
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const db = getDrizzle();
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (!dbUser) {
    return NextResponse.json({ error: "user not found" }, { status: 401 });
  }

  // 2) Parse + validate JSON
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const siteUrl = (body as any)?.siteUrl as string | undefined;
  const requestedSiteId = (body as any)?.siteId as string | undefined;
  if (!siteUrl) {
    return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
  }

  // 3) Validate URL + normalize
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad scheme");
  } catch {
    return NextResponse.json({ error: "Enter a valid site URL" }, { status: 400 });
  }
  const normalizedUrl = normalizeInput(parsed.toString());
  const host = new URL(normalizedUrl).hostname.replace(/^www\./, "").toLowerCase();

  // 4) Optional allowlist
  const allowRx = process.env.ALLOWED_SITE_HOST_REGEX
    ? new RegExp(process.env.ALLOWED_SITE_HOST_REGEX, "i")
    : null;
  if (allowRx && !allowRx.test(host)) {
    return NextResponse.json({ error: "domain not allowed (private beta)" }, { status: 403 });
  }

  // 5) Rate limit (10 attempts per 10 min per user+IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`pair-start:${dbUser.id}:${ip}`, 10, 10 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many attempts, try again later", retryAt: rl.resetAt },
      { status: 429 },
    );
  }

  // 5.5) Resolve existing site to reuse
  let existingSiteId: string | null = null;
  if (requestedSiteId) {
    const [row] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, requestedSiteId), eq(sites.userId, dbUser.id)))
      .limit(1);
    existingSiteId = row?.id ?? null;
  }
  if (!existingSiteId) {
    const [row] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(
        and(
          eq(sites.userId, dbUser.id),
          or(
            eq(sites.canonicalHost, host),
            eq(sites.siteUrl, normalizedUrl),
            eq(sites.siteUrl, normalizedUrl.replace(/\/$/, "")),
            eq(sites.siteUrl, `${normalizedUrl.replace(/\/$/, "")}/`),
          ),
        ),
      )
      .limit(1);
    existingSiteId = row?.id ?? null;
  }

  // 6) Reserve code + probe plugin in parallel — both are now instant / async
  const id = crypto.randomUUID();
  const now = Date.now();

  const pairCode = await reserveUniquePairCode();

  // Keep pairing-code generation fast and deterministic.
  // Plugin probe is best-effort UX signal and must never block pairing.
  const pluginDetected = await probePluginWithDeadline(normalizedUrl, 1200);

  // 7) Write full pairing record to Redis (two keys: by-code + by-id)
  const record = {
    id,
    siteUrl: normalizedUrl,
    pairCode,
    createdAt: now,
    expiresAt: now + PAIRING_TTL_SEC * 1000,
    used: false,
    userId: dbUser.id,
    siteId: existingSiteId ?? undefined,
  };
  await Promise.all([
    redis.set(`pairing:code:${pairCode}`, JSON.stringify(record), { ex: PAIRING_TTL_SEC }),
    redis.set(`pairing:id:${id}`, JSON.stringify(record), { ex: PAIRING_TTL_SEC }),
  ]);

  return NextResponse.json(
    {
      pairCode,
      pluginDetected,
      recordedSiteUrl: normalizedUrl,
      existingSiteId: existingSiteId || null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

