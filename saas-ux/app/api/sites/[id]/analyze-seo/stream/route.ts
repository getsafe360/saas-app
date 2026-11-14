// app/api/sites/[id]/analyze-seo/stream/route.ts
// Streams the SEO-GEO audit. Measured findings first: the deterministic checks
// of the site crawl (robots.txt, AI crawlers, llms.txt, sitemap, up to 10
// pages), which are final. Then the AI model judges only content quality,
// E-E-A-T and answerability from the crawled page excerpts, and every AI
// finding must cite a crawled page. Persists the completed job to the DB.

import "server-only";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { teams, teamMembers } from "@/lib/db/schema/auth/teams";
import { aiAnalysisJobs, aiRepairActions } from "@/lib/db/schema/ai/analysis";
import type { SeoFinding, AutomatedFix } from "@/lib/db/schema/ai/analysis";
import {
  getUserTier,
  isBSBTier,
  usesClaudeModel,
  getSeoAnalysisModel,
  getModelLabel,
  ANALYSIS_TOKEN_COST,
  OPUS_MODEL_ID,
  OPUS_THINKING_BUDGET,
  AGENT_NAME,
} from "@/lib/ai/models";
import { isPublicUrlResolved } from "@/lib/net/isPublicUrlResolved";
import { evaluateSeoGeo } from "@/lib/engine/seo/report";
import type { SeoCrawl } from "@/lib/engine/seo/facts";
import { crawlSite } from "@/lib/seo/crawl";
import { loadCrawl, saveCrawl } from "@/lib/seo/store";
import {
  acceptJudgement,
  buildAuditInput,
  buildJudgementPrompt,
  buildJudgementUserPrompt,
  computeMasterScore,
  crawledPageText,
  measuredToSeoFindings,
} from "@/lib/seo/audit";
import { getAvailableTokens } from "@/lib/fix/tokens";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A crawl younger than this is reused; the measured panel and the audit then agree. */
const CRAWL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const db = getDrizzle();

  // Resolve internal user
  const [dbUser] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  // Verify site ownership
  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) {
    return new Response(JSON.stringify({ error: "SITE_NOT_FOUND" }), { status: 404 });
  }

  // Resolve team + token budget
  const [teamRow] = await db
    .select({
      id: teams.id,
      tokensRemaining: teams.tokensRemaining,
      tokensUsedThisMonth: teams.tokensUsedThisMonth,
      planName: teams.planName,
    })
    .from(teams)
    .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, dbUser.id))
    .limit(1);

  const tier = await getUserTier();
  const estimatedCost = ANALYSIS_TOKEN_COST[tier];

  // Tokens reserved by prepared fix proposals are not spendable here (they are charged when
  // the fix is applied), so compare against the AVAILABLE balance, not the raw one.
  if (teamRow) {
    const { available } = await getAvailableTokens(teamRow.id);
    if (available < estimatedCost) {
      return new Response(
        JSON.stringify({ error: "INSUFFICIENT_TOKENS", tokensRemaining: available }),
        { status: 402 },
      );
    }
  }

  // The measured facts: the latest crawl when fresh, otherwise a new one (stored for the panel too).
  // Crawls stored before page excerpts existed cannot ground the review, so they are redone too.
  let crawl: SeoCrawl | null = await loadCrawl(siteId).catch(() => null);
  if (
    !crawl ||
    Date.now() - Date.parse(crawl.checkedAt) > CRAWL_MAX_AGE_MS ||
    crawl.pages.some((page) => typeof page.excerpt !== "string")
  ) {
    try {
      crawl = await crawlSite(site.siteUrl, { validate: isPublicUrlResolved });
      if (crawl.pages.length > 0) await saveCrawl(siteId, crawl, evaluateSeoGeo(crawl).scores).catch(() => {});
    } catch {
      crawl = null;
    }
  }
  if (!crawl || crawl.pages.length === 0) {
    return new Response(JSON.stringify({ error: "SITE_UNREACHABLE" }), { status: 502 });
  }
  const measured = evaluateSeoGeo(crawl).findings;
  const auditInput = buildAuditInput(crawl, measured);
  const crawledPages = crawledPageText(crawl);

  // Resolve model for this tier
  const model = getSeoAnalysisModel(tier);
  const modelId = usesClaudeModel(tier) ? OPUS_MODEL_ID : (process.env.MODEL ?? "gpt-4o");
  const provider = usesClaudeModel(tier) ? "anthropic" : "openai";

  // Create DB job record (status: running)
  const [analysisJob] = await db
    .insert(aiAnalysisJobs)
    .values({
      siteId,
      userId: dbUser.id,
      status: "running",
      selectedModules: { seo: true },
      locale: "en",
      analysisDepth: tier === "business" ? "deep" : "balanced",
      safeMode: true,
      modelId,
      provider,
      startedAt: new Date(),
    })
    .returning({ id: aiAnalysisJobs.id });

  if (!analysisJob) {
    return new Response(JSON.stringify({ error: "JOB_CREATE_FAILED" }), { status: 500 });
  }

  const jobId = analysisJob.id;
  const userName = dbUser.name ?? undefined;
  const findings: SeoFinding[] = [];
  let totalTokensUsed = 0;

  // ---------------------------------------------------------------------------
  // Stream: collect findings, pipe to client, persist on completion
  // ---------------------------------------------------------------------------

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Emit the job metadata first so the client knows the jobId immediately
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            type: "job_started",
            jobId,
            siteUrl: site.siteUrl,
            userName,
            tier,
            modelLabel: getModelLabel(tier),
            estimatedTokenCost: estimatedCost,
          }) + "\n",
        ),
      );

      try {
        // Measured findings: final, shown at once.
        for (const finding of measuredToSeoFindings(measured)) {
          findings.push(finding);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "finding", ...finding }) + "\n"));
        }
        const usedIds = new Set(findings.map((f) => f.id));
        const takeLine = (line: string) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            return; // partial or non-JSON line
          }
          const finding = acceptJudgement(parsed, crawledPages, usedIds);
          if (!finding) return;
          findings.push(finding);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "finding", ...finding }) + "\n"));
        };

        const extraOptions = isBSBTier(tier)
          ? {
              experimental_providerMetadata: {
                anthropic: { thinking: { type: "enabled" as const, budgetTokens: OPUS_THINKING_BUDGET } },
              },
            }
          : {};

        const result = streamText({
          model,
          system: buildJudgementPrompt(AGENT_NAME),
          messages: [{ role: "user", content: buildJudgementUserPrompt(auditInput, userName) }],
          temperature: 0.1,
          maxOutputTokens: 8_000,
          ...extraOptions,
        });

        let buffer = "";

        for await (const chunk of result.textStream) {
          buffer += chunk;
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) takeLine(trimmed);
          }
        }

        // Process any remaining buffer content
        if (buffer.trim()) takeLine(buffer.trim());

        // Collect token usage
        const usage = await result.usage;
        totalTokensUsed = (usage?.totalTokens ?? estimatedCost);

        // Compute master score
        const masterScore = computeMasterScore(findings, totalTokensUsed, modelId, provider);

        // Emit master score to client
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "master_score", ...masterScore }) + "\n",
          ),
        );

        // Persist findings to DB
        if (findings.length > 0) {
          await db.insert(aiRepairActions).values(
            findings.map((f) => ({
              analysisJobId: jobId,
              siteId,
              issueId: f.id,
              seoSection: f.section,
              category: "seo",
              actionId: f.id,
              title: f.title,
              severity: f.severity,
              score: f.score,
              impact: f.impact,
              automatedFix: f.automatedFix as AutomatedFix,
              repairMethod: f.automatedFix?.type ?? "manual",
              status: "pending" as const,
              reportIncluded: true,
              // Intentionally false: the user's repair selection (via /repair-queue)
              // is the authoritative gate. The UI pre-checks critical/high findings as a
              // convenience, but only items the user confirms get queued for elaboration.
              addedToRepairQueue: false,
            })),
          );
        }

        // Mark job completed
        await db
          .update(aiAnalysisJobs)
          .set({
            status: "completed",
            issuesFound: findings.length,
            repairableIssues: findings.filter((f) => f.automatedFix?.type !== "manual").length,
            tokensUsed: totalTokensUsed,
            results: masterScore as unknown as Record<string, unknown>,
            completedAt: new Date(),
          })
          .where(eq(aiAnalysisJobs.id, jobId));

        // Burn tokens atomically (SQL increments avoid race conditions with concurrent jobs)
        if (teamRow) {
          await db
            .update(teams)
            .set({
              tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${totalTokensUsed}`,
              tokensRemaining: sql`GREATEST(0, ${teams.tokensRemaining} - ${totalTokensUsed})`,
            })
            .where(eq(teams.id, teamRow.id));
        }

        // Final completion event to client
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              jobId,
              totalFindings: findings.length,
              totalTokensUsed,
              tokensRemaining: teamRow
                ? Math.max(0, (teamRow.tokensRemaining ?? 0) - totalTokensUsed)
                : 0,
            }) + "\n",
          ),
        );
      } catch (err) {
        // Mark job failed
        await db
          .update(aiAnalysisJobs)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(aiAnalysisJobs.id, jobId));

        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", message: (err as Error).message }) + "\n",
          ),
        );
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
      "X-Job-Id": jobId,
    },
  });
}
