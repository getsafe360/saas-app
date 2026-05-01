// app/api/sites/[id]/seo-fix/stream/route.ts
// Streams the SEO-GEO AI Fixer: fetches queued repair actions for a job,
// uses Claude to elaborate each fix with detailed implementation steps,
// persists the enhanced fix back to the DB, and streams progress events.
//
// Stream event types:
//   { type: "started",  jobId, total }
//   { type: "fix_item", id, title, severity, section, status: "processing" }
//   { type: "fix_item", id, title, severity, section, status: "done", detail, snippet? }
//   { type: "fix_item", id, title, severity, section, status: "skipped", reason }
//   { type: "done",     applied, skipped, totalTokensUsed }
//   { type: "error",    message }

import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { teams, teamMembers } from "@/lib/db/schema/auth/teams";
import { aiAnalysisJobs, aiRepairActions } from "@/lib/db/schema/ai/analysis";
import type { AiRepairAction } from "@/lib/db/schema/ai/analysis";

export const runtime = "nodejs";
export const maxDuration = 180;

// Claude Haiku 4.5 — fast and cheap for elaborating fix instructions
const FIXER_MODEL = "claude-haiku-4-5-20251001";

const client = new Anthropic();

function enc(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

// Build a tightly scoped prompt for elaborating a single SEO fix
function buildFixPrompt(action: AiRepairAction, siteUrl: string): string {
  const fix = action.automatedFix as {
    type: string;
    description: string;
    snippet?: string;
    effort: string;
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
  "steps": ["string", ...],
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

  // Verify user and site ownership
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

  // Verify job belongs to this site
  const [job] = await db
    .select({ id: aiAnalysisJobs.id })
    .from(aiAnalysisJobs)
    .where(and(eq(aiAnalysisJobs.id, jobId), eq(aiAnalysisJobs.siteId, siteId)))
    .limit(1);

  if (!job) {
    return new Response(enc({ type: "error", message: "JOB_NOT_FOUND" }), { status: 404 });
  }

  // Fetch team for token accounting
  const [teamRow] = await db
    .select({ id: teams.id, tokensRemaining: teams.tokensRemaining })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, dbUser.id))
    .limit(1);

  // Fetch queued repair actions for this job
  const queuedActions = await db
    .select()
    .from(aiRepairActions)
    .where(
      and(
        eq(aiRepairActions.analysisJobId, jobId),
        eq(aiRepairActions.siteId, siteId),
        eq(aiRepairActions.addedToRepairQueue, true),
      ),
    );

  if (queuedActions.length === 0) {
    return new Response(
      enc({ type: "error", message: "No items in repair queue for this job" }),
      { status: 409 },
    );
  }

  // Skip purely manual fixes — they need human action, not AI elaboration
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

        // Notify skipped manual items upfront
        for (const a of skippedManual) {
          emit({
            type: "fix_item",
            id: a.id,
            title: a.title,
            severity: a.severity,
            section: a.seoSection,
            status: "skipped",
            reason: "Manual fix — implementation instructions included in the finding.",
          });
        }

        // Process actionable fixes sequentially (rate-friendly, ordered output)
        for (const action of actionable) {
          emit({
            type: "fix_item",
            id: action.id,
            title: action.title,
            severity: action.severity,
            section: action.seoSection,
            status: "processing",
          });

          try {
            const prompt = buildFixPrompt(action, site.siteUrl);

            const response = await client.messages.create({
              model: FIXER_MODEL,
              max_tokens: 800,
              messages: [{ role: "user", content: prompt }],
            });

            const rawText = response.content
              .filter((b) => b.type === "text")
              .map((b) => (b as { type: "text"; text: string }).text)
              .join("");

            totalTokensUsed += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

            let elaborated: {
              summary: string;
              steps: string[];
              snippet: string | null;
              expectedImpact: string;
            } | null = null;

            try {
              elaborated = JSON.parse(rawText);
            } catch {
              // Fallback: wrap raw text as summary
              elaborated = { summary: rawText.slice(0, 200), steps: [], snippet: null, expectedImpact: "" };
            }

            // Merge elaborated fix into the existing automatedFix object
            const existingFix = (action.automatedFix as Record<string, unknown> | null) ?? {};
            const enhancedFix = {
              ...existingFix,
              elaboratedSummary: elaborated?.summary,
              elaboratedSteps: elaborated?.steps,
              elaboratedSnippet: elaborated?.snippet ?? existingFix.snippet,
              expectedImpact: elaborated?.expectedImpact,
            };

            // Persist enhanced fix + mark applied
            await db
              .update(aiRepairActions)
              .set({
                status: "applied",
                automatedFix: enhancedFix,
                tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
                modelId: FIXER_MODEL,
                provider: "anthropic",
                executedAt: new Date(),
              })
              .where(eq(aiRepairActions.id, action.id));

            applied++;

            emit({
              type: "fix_item",
              id: action.id,
              title: action.title,
              severity: action.severity,
              section: action.seoSection,
              status: "done",
              detail: elaborated?.summary,
              steps: elaborated?.steps,
              snippet: elaborated?.elaboratedSnippet ?? elaborated?.snippet,
              expectedImpact: elaborated?.expectedImpact,
            });
          } catch (err) {
            // Single-item failure — mark as failed, keep streaming others
            await db
              .update(aiRepairActions)
              .set({ status: "failed", errorMessage: (err as Error).message })
              .where(eq(aiRepairActions.id, action.id));

            emit({
              type: "fix_item",
              id: action.id,
              title: action.title,
              severity: action.severity,
              section: action.seoSection,
              status: "failed",
              reason: (err as Error).message,
            });
          }
        }

        // Burn tokens from team balance
        if (teamRow && totalTokensUsed > 0) {
          const { sql } = await import("drizzle-orm");
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
          tokensRemaining: teamRow ? Math.max(0, (teamRow.tokensRemaining ?? 0) - totalTokensUsed) : 0,
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
