// app/api/sites/[id]/repair-queue/route.ts
// Marks selected aiRepairActions as addedToRepairQueue = true.
// Called when the user checks findings in the SEO drawer and clicks "Fix with Sparky".

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
  issueIds: z.array(z.string()).min(1).max(200),
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

  const { jobId, issueIds } = parsed.data;
  const db = getDrizzle();

  // Verify site ownership
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

  // Mark selected repair actions as queued
  const result = await db
    .update(aiRepairActions)
    .set({ addedToRepairQueue: true })
    .where(
      and(
        eq(aiRepairActions.analysisJobId, jobId),
        eq(aiRepairActions.siteId, siteId),
        inArray(aiRepairActions.issueId, issueIds),
      ),
    )
    .returning({ id: aiRepairActions.id });

  return NextResponse.json({ ok: true, queued: result.length });
}
