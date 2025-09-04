// app/api/connect/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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

  return NextResponse.json({
    pairCode,
    pluginDetected: false, // you can probe /wp-json/getsafe/v1/ping later
  });
}
