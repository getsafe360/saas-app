export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db/drizzle";
import { scanJobs, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Category = "seo" | "performance" | "accessibility" | "security";

export async function POST(req: NextRequest) {
  const db = getDb();
  const { siteId, categories } = (await req.json()) as {
    siteId: string;
    categories?: Category[];
  };

  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });

  const cats = (categories && categories.length
    ? categories
    : (["seo", "performance", "accessibility", "security"] as Category[]));

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return NextResponse.json({ error: "site not found" }, { status: 404 });

  const jobId = crypto.randomUUID();

  await db.insert(scanJobs).values({
    id: jobId,
    siteId,
    status: "queued",
    categories: cats.join(","),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ jobId });
}
