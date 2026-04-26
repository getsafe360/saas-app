// app/api/sites/[id]/analyze-seo/stream/route.ts
// Streams a comprehensive SEO-GEO audit for a site using Claude Opus 4.7 (BSB)
// or GPT-4o-mini (other tiers). Emits one JSON finding per chunk, finalised
// with a master score summary. Persists the completed job to the DB.

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
import type { SeoFinding, SeoMasterScore, SeoSection, AutomatedFix } from "@/lib/db/schema/ai/analysis";
import {
  getUserTier,
  isBSBTier,
  getSeoAnalysisModel,
  getModelLabel,
  ANALYSIS_TOKEN_COST,
  OPUS_MODEL_ID,
  OPUS_THINKING_BUDGET,
  AGENT_NAME,
} from "@/lib/ai/models";
import { preScan } from "@/lib/analyzer/preScan";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionMaxScore(section: SeoSection): number {
  const map: Record<SeoSection, number> = {
    "technical-seo": 100,
    "content-eeat": 25,
    "ai-seo": 30,
    geo: 30,
    aeo: 25,
    "author-seo": 25,
    "ai-analytics": 25,
    "llms-txt": 25,
  };
  return map[section] ?? 25;
}

/**
 * Normalise section raw scores into the 7-component AI Visibility score
 * and combine with the Traditional SEO score to produce a Master Score 0-100.
 */
function computeMasterScore(
  findings: SeoFinding[],
  tokensUsed: number,
  modelId: string,
  provider: string,
): SeoMasterScore {
  const sectionScores: Record<SeoSection, { total: number; count: number }> = {
    "technical-seo": { total: 0, count: 0 },
    "content-eeat": { total: 0, count: 0 },
    "ai-seo": { total: 0, count: 0 },
    geo: { total: 0, count: 0 },
    aeo: { total: 0, count: 0 },
    "author-seo": { total: 0, count: 0 },
    "ai-analytics": { total: 0, count: 0 },
    "llms-txt": { total: 0, count: 0 },
  };

  for (const f of findings) {
    const s = sectionScores[f.section];
    if (s) {
      s.total += f.score;
      s.count++;
    }
  }

  function avg(section: SeoSection): number {
    const s = sectionScores[section];
    if (!s || s.count === 0) return 0;
    const maxPerFinding = 5;
    // Normalise: average finding score / max × section max score
    return Math.round((s.total / s.count / maxPerFinding) * sectionMaxScore(section));
  }

  const technicalSeo = avg("technical-seo");
  const aiSeo = avg("ai-seo");
  const geo = avg("geo");
  const aeo = avg("aeo");
  const authorSeo = avg("author-seo");
  const aiAnalytics = avg("ai-analytics");
  const aiCitation = avg("ai-analytics"); // shared section
  const llmsTxt = avg("llms-txt");

  // AI Visibility sub-score (avg of 7 components, normalised to 0-100)
  const aiVisibility = Math.round(
    ((aiSeo / 30 + geo / 30 + aeo / 25 + authorSeo / 25 + aiAnalytics / 25 + aiCitation / 25 + llmsTxt / 25) / 7) * 100,
  );

  // Master = 50% traditional SEO + 50% AI visibility
  const master = Math.round(0.5 * (technicalSeo) + 0.5 * aiVisibility);

  return {
    technicalSeo,
    aiSeo,
    geo,
    aeo,
    authorSeo,
    aiAnalytics,
    aiCitation,
    llmsTxt,
    master,
    totalTokensUsed: tokensUsed,
    modelId,
    provider,
  };
}

// ---------------------------------------------------------------------------
// SEO-GEO System Prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(agentName: string): string {
  return `You are ${agentName}, an enterprise-grade SEO and AI Visibility analyst built into the GetSafe360 platform.

Your task is to perform a comprehensive SEO-GEO audit of the provided website data. You must analyse all 8 sections and output findings as a stream of JSON objects — one JSON object per line, each on its own line (NDJSON format).

## Output format — STRICT

Each finding must be a single valid JSON object on ONE line:
{"type":"finding","id":"<unique-slug>","section":"<section>","title":"<title>","severity":"<severity>","score":<0-5>,"impact":"<2-3 sentence impact>","automatedFix":{"type":"<code|config|content|manual>","description":"<what to do>","snippet":"<optional ready-to-paste code>","effort":"<low|medium|high>"}}

After ALL findings, emit ONE final line:
{"type":"complete","sectionsAnalysed":8,"totalFindings":<n>}

## Section identifiers (use exactly these strings)
- "technical-seo"  — Technical foundations: indexability, canonicals, HTTPS, sitemap, URL structure, on-page (title/meta/headings), internal links, mobile, Core Web Vitals
- "content-eeat"   — Content quality, E-E-A-T signals, structured data (Organization, Breadcrumb, Article, Product, FAQ, HowTo, LocalBusiness)
- "ai-seo"         — AI Search Optimization: AI-readable structure, summarizability, entity density, fact consistency, AI-friendly formatting, AI-safe canonicalization
- "geo"            — Generative Engine Optimization: GEO schema coverage, topic authority, query coverage, answerability, freshness, multi-locale signals
- "aeo"            — Answer Engine Optimization: Q&A coverage, answer depth, conversational query coverage, structured answers, voice-friendly content
- "author-seo"     — Author SEO & E-E-A-T for AI: identity markup, experience signals, expertise verification, authority signals, trust signals
- "ai-analytics"   — AI Search Analytics + AI Citation Rate: AI query impressions, answer share, traffic attribution, snippet presence, citation frequency/accuracy/diversity
- "llms-txt"       — LLM Authorization: llms.txt presence, allowed/disallowed paths, model-specific permissions (OpenAI/Anthropic/Google/Perplexity), attribution requirements, update frequency

## Severity scale
- "critical" — Blocks AI/search visibility entirely; fix immediately
- "high"     — Significant negative impact on rankings or AI citations
- "medium"   — Moderate impact; important for competitive positioning
- "low"      — Minor refinements; good to have

## Score scale (per finding)
- 0 = completely missing/broken
- 1-2 = partial/poor implementation
- 3 = acceptable baseline
- 4 = good implementation
- 5 = excellent / fully optimized

## Rules
1. Generate 4-8 findings per section (32-64 findings total)
2. Be specific — reference actual values from the site data provided
3. Impact text must explain the BUSINESS consequence (rankings, AI citations, conversions)
4. automatedFix.snippet must be ready-to-paste code when type is "code" (HTML, JSON-LD, etc.)
5. Never emit anything except valid NDJSON lines — no prose, no markdown, no explanations outside the JSON
6. Analyse ALL 8 sections even if data is sparse — use "low" severity and score 2-3 for unknowns`;
}

function buildUserPrompt(siteData: Record<string, unknown>, userName?: string): string {
  const greeting = userName ? `User: ${userName}` : "User: (anonymous)";
  return `${greeting}

## Site data for audit:
${JSON.stringify(siteData, null, 2)}

Perform the full 8-section SEO-GEO audit now. Emit findings as NDJSON.`;
}

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

  if (teamRow && teamRow.tokensRemaining < estimatedCost) {
    return new Response(
      JSON.stringify({ error: "INSUFFICIENT_TOKENS", tokensRemaining: teamRow.tokensRemaining }),
      { status: 402 },
    );
  }

  // Fetch live site data (lightweight HTML scan for the prompt)
  let siteData: Record<string, unknown> = { url: site.siteUrl };
  try {
    const facts = await preScan(site.siteUrl);
    siteData = { url: site.siteUrl, ...facts };
  } catch {
    // Proceed with minimal data if preScan fails
  }

  // Resolve model for this tier
  const model = getSeoAnalysisModel(tier);
  const modelId = tier === "business" ? OPUS_MODEL_ID : (process.env.MODEL ?? "gpt-4o-mini");
  const provider = tier === "business" ? "anthropic" : "openai";

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
        const extraOptions = isBSBTier(tier)
          ? {
              experimental_providerMetadata: {
                anthropic: { thinking: { type: "enabled" as const, budgetTokens: OPUS_THINKING_BUDGET } },
              },
            }
          : {};

        const result = streamText({
          model,
          system: buildSystemPrompt(AGENT_NAME),
          messages: [{ role: "user", content: buildUserPrompt(siteData, userName) }],
          temperature: 0.1,
          maxOutputTokens: 16_000,
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
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed) as Record<string, unknown>;

              if (parsed.type === "finding") {
                const finding = parsed as unknown as SeoFinding;
                findings.push(finding);
                // Forward finding to client
                controller.enqueue(encoder.encode(trimmed + "\n"));
              } else if (parsed.type === "complete") {
                // Will be handled after stream finishes
              }
            } catch {
              // Partial JSON or non-JSON line — skip silently
            }
          }
        }

        // Process any remaining buffer content
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim()) as Record<string, unknown>;
            if (parsed.type === "finding") {
              findings.push(parsed as unknown as SeoFinding);
              controller.enqueue(encoder.encode(buffer.trim() + "\n"));
            }
          } catch {
            // ignore
          }
        }

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
              provider,
              modelId,
              reportIncluded: true,
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
