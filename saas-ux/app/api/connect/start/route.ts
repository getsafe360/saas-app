// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { getUser } from "@/lib/db/queries";
import { rateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Normalize the user-supplied site URL so we store a consistent value.
// - strips search + hash
// - lowercases hostname
// - collapses trailing slashes to exactly one (for roots)
// - keeps protocol (http/https) as provided
function normalizeInput(u: string): string {
  try {
    const url = new URL(u);
    url.search = "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/";
    }
    return url.toString();
  } catch {
    return u;
  }
}

async function probePlugin(siteUrl: string): Promise<boolean> {
  const targets = [
    "/wp-json/getsafe/v1/ping",      // pretty permalinks
    "/?rest_route=/getsafe/v1/ping", // plain permalinks
  ];
  for (const path of targets) {
    try {
      const url = new URL(path, siteUrl).toString();
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: "GET",
        headers: { "user-agent": "GetSafe360/0.1 (+connect-probe)" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      if (json && json.ok === true) return true; // plugin’s ping returns { ok: true }
    } catch {
      /* ignore and try next */
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  // ✅ Require auth
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const { siteUrl } = await req.json();

  // Validate using URL() (more reliable than regex)
  let parsed: URL | null = null;
  try {
    parsed = new URL(siteUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad scheme");
    }
  } catch {
    return NextResponse.json({ error: "Enter a valid site URL" }, { status: 400 });
  }

  // Normalize before storing / probing
  const normalizedUrl = normalizeInput(parsed.toString());
  const host = new URL(normalizedUrl).hostname.toLowerCase().replace(/^www\./, "");

  // ✅ Optional allowlist (private beta)
  const allowRx = process.env.ALLOWED_SITE_HOST_REGEX
    ? new RegExp(process.env.ALLOWED_SITE_HOST_REGEX, "i")
    : null;
  if (allowRx && !allowRx.test(host)) {
    return NextResponse.json({ error: "domain not allowed (private beta)" }, { status: 403 });
  }

  // ✅ Lightweight rate-limit (10 requests / 10 minutes per user+IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`pair-start:${user.id}:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many attempts, try again later", retryAt: rl.resetAt },
      { status: 429 }
    );
  }

  // 6-digit pairing code
  const pairCode = String(Math.floor(100000 + Math.random() * 900000));
  const id = crypto.randomUUID();

  const record = {
    id,
    siteUrl: normalizedUrl,
    pairCode,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    used: false,
    userId: user.id, // ✅ link owner for handshake/DB upsert
  };

  // Store by code for easy lookup during handshake
  // NOTE: public is fine for MVP; we’re not storing secrets here.
  await put(`pairings/code-${pairCode}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });

  // (Optional) also store by id if you want backfill/debug later
  await put(`pairings/id-${id}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });

  const pluginDetected = await probePlugin(normalizedUrl);

  return NextResponse.json({
    pairCode,
    pluginDetected,
    recordedSiteUrl: normalizedUrl,
  });
}
