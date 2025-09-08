// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";

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

    // remove query + hash noise
    url.search = "";
    url.hash = "";

    // lowercase hostname for consistency
    url.hostname = url.hostname.toLowerCase();

    // ensure a single trailing slash for root paths
    // (don't touch non-root paths; users should connect the site root)
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/";
    }

    return url.toString();
  } catch {
    // if it's not a valid URL, just return as-is; caller will validate
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
  const { siteUrl } = await req.json();

  // Validate using URL() (more reliable than regex)
  let parsed: URL | null = null;
  try {
    parsed = new URL(siteUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad scheme");
  } catch {
    return NextResponse.json({ error: "Enter a valid site URL" }, { status: 400 });
  }

  // Normalize before storing / probing
  const normalizedUrl = normalizeInput(parsed.toString());

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
  };

  // store by code for easy lookup during handshake
  // NOTE: public is fine for MVP; we’re not storing secrets here.
  await put(`pairings/code-${pairCode}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });

  // (optional) also store by id if you want backfill/debug later
  await put(`pairings/id-${id}.json`, JSON.stringify(record), {
    access: "public",
    contentType: "application/json",
  });

  const pluginDetected = await probePlugin(normalizedUrl);
  return NextResponse.json({ pairCode, pluginDetected, recordedSiteUrl: normalizedUrl });
}
