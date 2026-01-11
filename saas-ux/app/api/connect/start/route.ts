// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { list, put } from "@vercel/blob";
import crypto from "crypto";

import { getDrizzle } from "@/lib/db/postgres";
import { users } from '@/lib/db/schema/auth/users';
import { sites } from "@/lib/db/schema/sites";
import { rateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function probeOnce(siteUrl: string, path: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(new URL(path, siteUrl).toString(), {
      method: "GET",
      headers: { "user-agent": "GetSafe360/0.1 (+connect-probe)" },
      cache: "no-store",
      signal: controller.signal,
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
  // Try pretty + plain permalinks
  const paths = ["/wp-json/getsafe/v1/ping", "/?rest_route=/getsafe/v1/ping"];
  for (const p of paths) {
    if (await probeOnce(siteUrl, p)) return true;
  }

  // If original was http, try https (and vice-versa)
  try {
    const u = new URL(siteUrl);
    const flipped = new URL(siteUrl);
    flipped.protocol = u.protocol === "http:" ? "https:" : "http:";
    for (const p of paths) {
      if (await probeOnce(flipped.toString(), p)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function sixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureUniquePairCode(): Promise<string> {
  // Collision is super unlikely, but let’s be perfect: re-roll up to 5 times.
  for (let i = 0; i < 5; i++) {
    const code = sixDigitCode();
    const { blobs } = await list({ prefix: `pairings/code-${code}.json` });
    if (blobs.length === 0) return code;
  }
  // Fallback to uuid segment if we somehow hit collisions repeatedly
  return crypto.randomUUID().slice(0, 6);
}

// --- handler ---
export async function POST(req: NextRequest) {
  // 1) Auth (Clerk) → DB user
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

  // 4) Optional allowlist (private beta)
  const allowRx = process.env.ALLOWED_SITE_HOST_REGEX
    ? new RegExp(process.env.ALLOWED_SITE_HOST_REGEX, "i")
    : null;
  if (allowRx && !allowRx.test(host)) {
    return NextResponse.json({ error: "domain not allowed (private beta)" }, { status: 403 });
  }

  // 5) Rate limit (per user + IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`pair-start:${dbUser.id}:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many attempts, try again later", retryAt: rl.resetAt },
      { status: 429 }
    );
  }

  // 5.5) ✅ GUARD: check if this user already has a site for this host
  // We don't have a "host" column, so compare lower(site_url) LIKE '%//host/%'
  const likePattern = `%//${host}/%`.toLowerCase();
  const existing = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.userId, dbUser.id),
        sql`lower(${sites.siteUrl}) LIKE ${likePattern}`
      )
    )
    .limit(1);
  const existingSiteId = existing[0]?.id ?? null;

  // 6) Generate unique code + write records
  const pairCode = await ensureUniquePairCode();
  const id = crypto.randomUUID();
  const record = {
    id,
    siteUrl: normalizedUrl,
    pairCode,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    used: false,
    userId: dbUser.id,           // link to DB user; handshake will trust this
    siteId: existingSiteId || undefined, // ✅ hint handshake to reuse this site
  };

  await put(`pairings/code-${pairCode}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });
  await put(`pairings/id-${id}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });

  // 7) Probe plugin availability (nice-to-have UX)
  const pluginDetected = await probePlugin(normalizedUrl);

  // 8) Done
  return NextResponse.json(
    {
      pairCode,
      pluginDetected,
      recordedSiteUrl: normalizedUrl,
      // optional: echo which site the handshake is likely to reuse
      existingSiteId: existingSiteId || null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
