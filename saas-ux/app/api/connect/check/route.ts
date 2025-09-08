// app/api/connect/check/route.ts
import { list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pairCode = searchParams.get("pairCode") || "";
  if (!pairCode) return NextResponse.json({ error: "pairCode required" }, { status: 400 });

  const { blobs } = await list({ prefix: `pairings/code-${pairCode}.json` });
  const b = blobs[0];
  if (!b) return NextResponse.json({ used: false, found: false });

  const rec = await fetch(b.url, { cache: "no-store" }).then(r => r.json()).catch(() => null);
  if (!rec) return NextResponse.json({ used: false, found: false });

  const found = true;
  const used = !!rec.used;
  const expiresAt = rec.expiresAt ?? null;
  const recordedSiteUrl = rec.siteUrl ?? null;

  // compute siteId same way as handshake (hostname hash is fine too)
  let siteId: string | undefined;
  if (used && recordedSiteUrl) {
    const crypto = await import("crypto");
    siteId = crypto.createHash("sha256").update(recordedSiteUrl).digest("hex").slice(0, 16);
  }

  return NextResponse.json({ found, used, siteId, recordedSiteUrl, expiresAt });
}
