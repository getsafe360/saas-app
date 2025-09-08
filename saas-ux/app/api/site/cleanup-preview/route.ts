// app/api/sites/cleanup-preview/route.ts
import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { blobs } = await list({ prefix: "sites/" });
  const invalid: string[] = [];

  for (const b of blobs) {
    const r = await fetch(b.url, { cache: "no-store" });
    const j = await r.json().catch(() => null);
    const key = (b as any).pathname ?? (b as any).key ?? new URL(b.url).pathname;
    const siteId = j?.siteId ?? key.replace(/^\/?sites\//, "").replace(/\.json$/i, "");
    const siteUrl = j?.siteUrl ?? j?.url ?? "";
    if (!siteId || !siteUrl) invalid.push(key);
  }

  return NextResponse.json({ invalid, count: invalid.length });
}
