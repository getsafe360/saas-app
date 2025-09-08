// app/api/connect/handshake/route.ts
import { list, put } from "@vercel/blob";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPairing(pairCode: string) {
  const { blobs } = await list({ prefix: `pairings/code-${pairCode}.json` });
  const b = blobs[0];
  if (!b) return null;
  const r = await fetch(b.url, { cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

// compare by hostname only (case-insensitive), ignoring leading "www."
function sameSite(a: string, b: string) {
  try {
    const A = new URL(a);
    const B = new URL(b);
    const hostA = A.hostname.replace(/^www\./, "").toLowerCase();
    const hostB = B.hostname.replace(/^www\./, "").toLowerCase();
    return hostA === hostB;
  } catch {
    return false;
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, allows: ["POST"] }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

export async function POST(req: NextRequest) {
  const { pairCode, siteUrl, wpVersion, pluginVersion } = await req.json();
  if (!pairCode || !siteUrl) {
    return NextResponse.json({ error: "pairCode and siteUrl required" }, { status: 400 });
  }

  const rec: any = await readPairing(pairCode);
  if (!rec) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  if (rec.used || rec.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Code expired or already used" }, { status: 400 });
  }
  if (!sameSite(rec.siteUrl, siteUrl)) {
    return NextResponse.json({ error: "Site URL mismatch" }, { status: 400 });
  }

  const siteToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(siteToken).digest("hex");
  const siteId = crypto.createHash("sha256").update(siteUrl).digest("hex").slice(0, 16);

  await put(
    `sites/${siteId}.json`,
    JSON.stringify({
      siteId,
      siteUrl,
      tokenHash,
      wpVersion,
      pluginVersion,
      scopes: ["optimize:read", "optimize:write", "webhook:send"],
      status: "connected",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    { access: "public", contentType: "application/json" }
  );

  // mark pairing as used
  rec.used = true;
  rec.usedAt = Date.now();
  await put(
    `pairings/code-${pairCode}.json`,
    JSON.stringify(rec),
    { access: "public", contentType: "application/json" }
  );

  return NextResponse.json({ siteId, siteToken });
}

