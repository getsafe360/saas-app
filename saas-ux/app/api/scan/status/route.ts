// saas-ux/app/api/scan/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/drizzle";
import { scanJobs, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { callAgentsService } from "@/lib/services/agents";
import { put } from "@vercel/blob";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [job] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // If job is queued, do the work now in this request (keeps MVP simple)
  if (job.status === "queued") {
    try {
      await db.update(scanJobs).set({ status: "running", updatedAt: new Date() }).where(eq(scanJobs.id, id));

     const [site] = await db.select().from(sites).where(eq(sites.id, job.siteId)).limit(1);
        if (!site) throw new Error("site missing");
        if (!site.siteUrl) throw new Error("site URL missing");

      const categories = (job.categories || "seo,performance,accessibility,security")
        .split(",")
        .map(c => c.trim())
        .filter(Boolean) as any;

      const { report, agentUsed } = await callAgentsService(site.siteUrl, categories);

      const blobKey = `reports/${job.siteId}/${job.id}.json`;
      await put(blobKey, JSON.stringify(report), {
        access: "public",
        contentType: "application/json",
        allowOverwrite: true,
      });

      const costTokens = report.summary.estTotalTokens || 0;

      await db
        .update(scanJobs)
        .set({
          status: "done",
          agentUsed,
          costTokens,
          reportBlobKey: blobKey,
          updatedAt: new Date(),
        })
        .where(eq(scanJobs.id, id));
    } catch (e: any) {
      await db
        .update(scanJobs)
        .set({
          status: "error",
          errorMessage: e?.message ?? "scan failed",
          updatedAt: new Date(),
        })
        .where(eq(scanJobs.id, id));
    }
  }

  const [fresh] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  return NextResponse.json({
    id: fresh.id,
    status: fresh.status,
    costTokens: fresh.costTokens,
    reportBlobKey: fresh.reportBlobKey,
    agentUsed: fresh.agentUsed,
    errorMessage: fresh.errorMessage,
    updatedAt: fresh.updatedAt,
  });
}
