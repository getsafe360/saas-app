// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probePlugin(siteUrl: string): Promise<boolean> {
  const targets = [
    "/wp-json/getsafe/v1/ping",          // pretty permalinks
    "/?rest_route=/getsafe/v1/ping",     // plain permalinks
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

  if (!/^https?:\/\/[^\s]+$/i.test(siteUrl || "")) {
    return NextResponse.json({ error: "Enter a valid site URL" }, { status: 400 });
  }

  // 6-digit pairing code
  const pairCode = String(Math.floor(100000 + Math.random() * 900000));
  const id = crypto.randomUUID();

  const record = {
    id,
    siteUrl,
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

  const pluginDetected = await probePlugin(siteUrl);
  return NextResponse.json({ pairCode, pluginDetected });
}
