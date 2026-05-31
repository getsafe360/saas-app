// app/api/sites/[id]/seo-analysis/latest/route.ts
// Returns the most recent completed SEO analysis job with all findings,
// so the SEO analysis page can restore persisted results instead of re-running.

import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { aiAnalysisJobs, aiRepairActions } from "@/lib/db/schema/ai/analysis";
import type { SeoFinding } from "@/lib/db/schema/ai/analysis";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);
  if (!dbUser) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);
  if (!site) {
    return new Response(JSON.stringify({ error: "SITE_NOT_FOUND" }), { status: 404 });
  }

  const [job] = await db
    .select()
    .from(aiAnalysisJobs)
    .where(and(eq(aiAnalysisJobs.siteId, siteId), eq(aiAnalysisJobs.status, "completed")))
    .orderBy(desc(aiAnalysisJobs.completedAt))
    .limit(1);

  if (!job) {
    return new Response(JSON.stringify({ found: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await db
    .select()
    .from(aiRepairActions)
    .where(eq(aiRepairActions.analysisJobId, job.id));

  const findings: SeoFinding[] = rows.map((r) => ({
    id: r.issueId ?? r.actionId ?? r.id,
    section: r.seoSection as SeoFinding["section"],
    title: r.title ?? "",
    severity: (r.severity ?? "low") as SeoFinding["severity"],
    score: r.score ?? 0,
    impact: r.impact ?? "",
    automatedFix: r.automatedFix as SeoFinding["automatedFix"],
    passed: r.score != null && r.score >= 4 ? true : undefined,
  }));

  return new Response(
    JSON.stringify({
      found: true,
      jobId: job.id,
      siteUrl: site.siteUrl,
      masterScore: job.results,
      findings,
      totalFindings: findings.length,
      totalTokensUsed: job.tokensUsed ?? 0,
      tokensRemaining: 0,
      modelLabel: job.modelId ?? "AI",
      completedAt: job.completedAt,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
