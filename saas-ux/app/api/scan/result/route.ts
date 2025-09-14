export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/drizzle";
import { scanJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [job] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  if (!job || job.status !== "done" || !job.reportBlobKey) {
    return NextResponse.json({ error: "no report" }, { status: 404 });
  }

  const r = await fetch(`https://blob.vercel-storage.com/${job.reportBlobKey}`).catch(() => null);
  if (!r || !r.ok) {
    // fallback to public URL in blob listing (if needed you can list->url)
    return NextResponse.json({ error: "report fetch failed" }, { status: 500 });
  }
  const report = await r.json();
  return NextResponse.json({ report });
}
