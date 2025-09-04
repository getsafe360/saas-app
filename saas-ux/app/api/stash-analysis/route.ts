import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const data = await req.json(); // { url, scores, screenshotUrl, faviconUrl, cms, ts }
  if (!data?.url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // keep payload small; add a created timestamp
  const payload = {
    ...data,
    ts: Date.now(),
    v: 1,
  };

  const key = `stashes/${crypto.randomUUID()}.json`;
  const res = await put(key, JSON.stringify(payload), {
    access: "public", // ok for demo; flip to "private" later if you move to KV/DB
    contentType: "application/json",
  });

  // return the blob key (not the public CDN URL), so you can fetch it once and then delete
  return NextResponse.json({ ok: true, stashKey: key, url: res.url });
}
