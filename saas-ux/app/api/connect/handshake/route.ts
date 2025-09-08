// app/api/connect/handshake/route.ts
import { list, put } from "@vercel/blob";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPairingByCode(pairCode: string) {
  const { blobs } = await list({ prefix: `pairings/code-${pairCode}.json` });
  const b = blobs[0];
  if (!b) return null;
  const r = await fetch(b.url, { cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

function hostnameKey(u: string) {
  const url = new URL(u);
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

function sameSite(a: string, b: string) {
  try {
    return hostnameKey(a) === hostnameKey(b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { pairCode, siteUrl, wpVersion, pluginVersion } = body as {
      pairCode?: string;
      siteUrl?: string;
      wpVersion?: string;
      pluginVersion?: string;
    };

    if (!pairCode || !siteUrl) {
      return NextResponse.json(
        { error: "pairCode and siteUrl required" },
        { status: 400 }
      );
    }

    const rec: any = await readPairingByCode(pairCode);
    if (!rec) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }
    if (rec.used || rec.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: "Code expired or already used" },
        { status: 400 }
      );
    }
    if (!sameSite(rec.siteUrl, siteUrl)) {
      return NextResponse.json(
        { error: "Site URL mismatch" },
        { status: 400 }
      );
    }

    // Mint token + stable siteId (based on hostname only)
    const siteToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(siteToken).digest("hex");
    const siteId = crypto
      .createHash("sha256")
      .update(hostnameKey(siteUrl))
      .digest("hex")
      .slice(0, 16);

    const siteRecord = {
      siteId,
      siteUrl,
      tokenHash,
      wpVersion: wpVersion ?? null,
      pluginVersion: pluginVersion ?? null,
      scopes: ["optimize:read", "optimize:write", "webhook:send"],
      status: "connected",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await put(`sites/${siteId}.json`, JSON.stringify(siteRecord), {
      access: "public",
      contentType: "application/json",
    });

    // mark pairing as used
    rec.used = true;
    rec.usedAt = Date.now();
    await put(`pairings/code-${pairCode}.json`, JSON.stringify(rec), {
      access: "public",
      contentType: "application/json",
    });

    return NextResponse.json({ siteId, siteToken });
  } catch (err: any) {
    // Visible in Vercel Logs (Project → Functions)
    console.error("Handshake error:", err);
    return NextResponse.json(
      { error: `Server error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}

// Optional: quick GET to verify the route is deployed at the expected domain
export async function GET() {
  return NextResponse.json({ ok: true, expects: "POST" });
}
