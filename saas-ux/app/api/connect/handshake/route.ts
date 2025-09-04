// app/api/connect/handshake/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { id, pairCode, siteUrl, wpVersion, pluginVersion } = await req.json();

  // load pairing record from Blob:
  // const rec = await readBlobJson(`pair/${id}.json`);
  const rec:any = null; // replace with actual

  if (!rec || rec.used || rec.expiresAt < Date.now() || rec.pairCode !== pairCode || rec.siteUrl !== siteUrl) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // mint a long-lived site token
  const siteToken = crypto.randomBytes(32).toString("base64url");
  const siteId = crypto.createHash("sha256").update(siteUrl).digest("hex").slice(0, 16);

  // persist site record (Blob for now)
  const siteRecord = {
    siteId, siteUrl, siteTokenHash: crypto.createHash("sha256").update(siteToken).digest("hex"),
    wpVersion, pluginVersion, scopes:["optimize:read","optimize:write","webhook:send"],
    createdAt: Date.now(), status:"connected"
  };
  // await put(`sites/${siteId}.json`, JSON.stringify(siteRecord), { access:"public", contentType:"application/json" });

  // mark pair as used
  // rec.used = true; await put(`pair/${id}.json`, JSON.stringify(rec), { access:"public", contentType:"application/json" });

  // return token to plugin (only over HTTPS)
  return NextResponse.json({ siteId, siteToken });
}
