import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { guardPublicWrite } from "@/lib/api/public-write-guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await guardPublicWrite(req, "stash-analysis");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const data = guard.data as { url?: unknown } & Record<string, unknown>; // { url, scores, screenshotUrl, faviconUrl, cms, ts }
  if (typeof data?.url !== "string" || !data.url || data.url.length > 2048) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

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
