// app/api/sites/[id]/seo-fix/stream/route.ts
// Streams the SEO-GEO AI Fixer: fetches queued repair actions for a job,
// uses Claude Haiku to elaborate each fix with detailed implementation steps,
// persists the enhanced fix back to the DB, and streams progress events.
//
// Stream event types (NDJSON):
//   { type: "started",  jobId, total }
//   { type: "fix_item", id, title, severity, section, status: "processing" }
//   { type: "fix_item", id, title, severity, section, status: "done", detail, steps?, snippet?, expectedImpact? }
//   { type: "fix_item", id, title, severity, section, status: "skipped", reason }
//   { type: "fix_item", id, title, severity, section, status: "failed",  reason }
//   { type: "done",     applied, skipped, totalTokensUsed }
//   { type: "error",    message }

import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { teams, teamMembers } from "@/lib/db/schema/auth/teams";
import { aiAnalysisJobs, aiRepairActions } from "@/lib/db/schema/ai/analysis";
import type { AiRepairAction } from "@/lib/db/schema/ai/analysis";

export const runtime = "nodejs";
export const maxDuration = 180;

// Claude Haiku 4.5 — fast and cheap for elaborating fix instructions
const FIXER_MODEL = anthropic("claude-haiku-4-5-20251001");
const FIXER_MODEL_ID = "claude-haiku-4-5-20251001";

function enc(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

function buildFixPrompt(action: AiRepairAction, siteUrl: string): string {
  const fix = action.automatedFix as {
    type?: string;
    description?: string;
    snippet?: string;
    effort?: string;
  } | null;

  return `You are an expert SEO & web developer writing precise fix instructions for a website owner.

Site: ${siteUrl}
Issue: ${action.title}
Severity: ${action.severity ?? "medium"}
Category: ${action.seoSection ?? action.category ?? "seo"}
Impact: ${action.impact ?? ""}
Fix type: ${fix?.type ?? "manual"}
Effort: ${fix?.effort ?? "medium"}
Current fix description: ${fix?.description ?? ""}
${fix?.snippet ? `Existing snippet hint:\n\`\`\`\n${fix.snippet}\n\`\`\`` : ""}

Write a concise, actionable fix plan with:
1. A 1-sentence summary of exactly what to do
2. Step-by-step implementation (max 4 steps, each max 1 sentence)
3. If the fix type is "code" or "config": provide a ready-to-paste code snippet (HTML/JSON-LD/htaccess/etc.)
4. Expected SEO impact after applying this fix (1 sentence)

Format your response as JSON matching this exact schema:
{
  "summary": "string",
  "steps": ["string"],
  "snippet": "string or null",
  "expectedImpact": "string"
}

Return ONLY valid JSON — no markdown fences, no extra text.`;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return new Response(enc({ type: "error", message: "UNAUTHORIZED" }), { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { jobId?: string };
  const { jobId } = body;
  if (!jobId) {
    return new Response(enc({ type: "error", message: "jobId required" }), { status: 400 });
  }

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) {
    return new Response(enc({ type: "error", message: "UNAUTHORIZED" }), { status: 401 });
  }

  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) {
    return new Response(enc({ type: "error", message: "SITE_NOT_FOUND" }), { status: 404 });
  }

  const [job] = await db
    .select({ id: aiAnalysisJobs.id })
    .from(aiAnalysisJobs)
    .where(and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.siteId, siteId)))
    .limit(1);

  if (!job) {
    return new Response(enc({ type: "error", message: "JOB_NOT_FOUND" }), { status: 404 });
  }

  const [teamRow] = await db
    .select({ id: teams.id, tokensRemaining: teams.tokensRemaining })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, dbUser.id))
    .limit(1);

  // Only fetch pending items — excludes rows already completed/failed by a
  // previous fixer run on the same job, preventing token double-charging.
  const queuedActions = await db
    .select()
    .from(aiRepairActions)
    .where(
      and(
        eq(aiRepairActions.analysisJobId, jobId),
        eq(aiRepairActions.siteId, siteId),
        eq(aiRepairActions.addedToRepairQueue, true),
        eq(aiRepairActions.status, "pending"),
      ),
    );

  if (queuedActions.length === 0) {
    return new Response(
      enc({ type: "error", message: "No items in repair queue for this job" }),
      { status: 409 },
    );
  }

  // Split manual (show instructions only) from actionable (AI-elaborated)
  const actionable = queuedActions.filter((a) => {
    const fix = a.automatedFix as { type?: string } | null;
    return fix?.type !== "manual";
  });
  const skippedManual = queuedActions.filter((a) => {
    const fix = a.automatedFix as { type?: string } | null;
    return fix?.type === "manual";
  });

  const encoder = new TextEncoder();
  let totalTokensUsed = 0;
  let applied = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(enc(obj)));

      try {
        emit({ type: "started", jobId, total: queuedActions.length, actionable: actionable.length });

        for (const a of skippedManual) {
          emit({
            type: "fix_item",
            id: a.id, title: a.title, severity: a.severity, section: a.seoSection,
            status: "skipped",
            reason: "Manual fix — follow the steps in the finding above.",
          });
        }

        for (const action of actionable) {
          emit({
            type: "fix_item",
            id: action.id, title: action.title, severity: action.severity, section: action.seoSection,
            status: "processing",
          });

          try {
            const { text, usage } = await generateText({
              model: FIXER_MODEL,
              prompt: buildFixPrompt(action, site.siteUrl),
              maxTokens: 800,
            });

            const inputTokens = usage?.promptTokens ?? 0;
            const outputTokens = usage?.completionTokens ?? 0;
            totalTokensUsed += inputTokens + outputTokens;

            let elaborated: {
              summary?: string;
              steps?: string[];
              snippet?: string | null;
              expectedImpact?: string;
            } | null = null;

            try {
              elaborated = JSON.parse(text) as typeof elaborated;
            } catch {
              elaborated = { summary: text.slice(0, 200), steps: [], snippet: null, expectedImpact: "" };
            }

            const existingFix = (action.automatedFix as Record<string, unknown> | null) ?? {};
            const enhancedFix = {
              ...existingFix,
              elaboratedSummary: elaborated?.summary,
              elaboratedSteps: elaborated?.steps,
              elaboratedSnippet: elaborated?.snippet ?? existingFix.snippet,
              expectedImpact: elaborated?.expectedImpact,
            };

            await db
              .update(aiRepairActions)
              .set({
                status: "completed",
                automatedFix: enhancedFix,
                tokensUsed: inputTokens + outputTokens,
                modelId: FIXER_MODEL_ID,
                provider: "anthropic",
                executedAt: new Date(),
              })
              .where(eq(aiRepairActions.id, action.id));

            applied++;

            emit({
              type: "fix_item",
              id: action.id, title: action.title, severity: action.severity, section: action.seoSection,
              status: "done",
              detail: elaborated?.summary,
              steps: elaborated?.steps,
              snippet: elaborated?.snippet,
              expectedImpact: elaborated?.expectedImpact,
            });
          } catch (err) {
            await db
              .update(aiRepairActions)
              .set({ status: "failed", errorMessage: (err as Error).message })
              .where(eq(aiRepairActions.id, action.id));

            emit({
              type: "fix_item",
              id: action.id, title: action.title, severity: action.severity, section: action.seoSection,
              status: "failed",
              reason: (err as Error).message,
            });
          }
        }

        // Burn tokens from team balance atomically
        if (teamRow && totalTokensUsed > 0) {
          await db
            .update(teams)
            .set({
              tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${totalTokensUsed}`,
              tokensRemaining: sql`GREATEST(0, ${teams.tokensRemaining} - ${totalTokensUsed})`,
            })
            .where(eq(teams.id, teamRow.id));
        }

        emit({
          type: "done",
          applied,
          skipped: skippedManual.length,
          totalTokensUsed,
          tokensRemaining: teamRow
            ? Math.max(0, (teamRow.tokensRemaining ?? 0) - totalTokensUsed)
            : 0,
        });
      } catch (err) {
        emit({ type: "error", message: (err as Error).message ?? "Fixer failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
