// app/api/sites/[id]/repair-queue/restore/route.ts
// Resets elaborated repair actions back to pending so a job can be re-run.
// Strips elaborated fields added by the seo-fix stream (elaboratedSummary,
// elaboratedSteps, elaboratedSnippet, expectedImpact) and resets status to
// "pending" so the fixer can re-process them.

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { aiRepairActions } from "@/lib/db/schema/ai/analysis";

const BodySchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const { jobId } = parsed.data;
  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) {
    return NextResponse.json({ ok: false, error: "SITE_NOT_FOUND" }, { status: 404 });
  }

  // Fetch completed actions for this job so we can strip elaborated fields
  const completed = await db
    .select({ id: aiRepairActions.id, automatedFix: aiRepairActions.automatedFix })
    .from(aiRepairActions)
    .where(
      and(
        eq(aiRepairActions.analysisJobId, jobId),
        eq(aiRepairActions.siteId, siteId),
        inArray(aiRepairActions.status, ["completed", "failed"]),
      ),
    );

  if (completed.length === 0) {
    return NextResponse.json({ ok: true, restored: 0 });
  }

  // Strip elaborated fields from each automatedFix JSONB in a single bulk update
  await Promise.all(
    completed.map((row) => {
      const fix = (row.automatedFix ?? {}) as Record<string, unknown>;
      const { elaboratedSummary: _, elaboratedSteps: __, elaboratedSnippet: ___, expectedImpact: ____, ...original } = fix;
      return db
        .update(aiRepairActions)
        .set({
          status: "pending",
          automatedFix: original,
          tokensUsed: null,
          provider: null,
          modelId: null,
          executedAt: null,
          errorMessage: null,
        })
        .where(eq(aiRepairActions.id, row.id));
    }),
  );

  return NextResponse.json({ ok: true, restored: completed.length });
}
