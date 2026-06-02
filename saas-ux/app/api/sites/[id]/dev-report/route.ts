// app/api/sites/[id]/dev-report/route.ts
// Generates a markdown developer report for a completed AI repair job.
// Called automatically by the SEOFixerPanel on repair completion.
//
// POST /api/sites/[id]/dev-report
//   body: { jobId: string }
//   returns: { url: string, filename: string }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { aiAnalysisJobs, aiRepairActions } from "@/lib/db/schema/ai/analysis";
import type { AiRepairAction } from "@/lib/db/schema/ai/analysis";
import { put } from "@vercel/blob";

function grade(score: number | undefined): string {
  if (!score) return "N/A";
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function fenceBlock(code: string | null | undefined): string {
  if (!code) return "";
  const lang = code.trimStart().startsWith("{") || code.trimStart().startsWith("[")
    ? "json"
    : code.trimStart().startsWith("<")
    ? "html"
    : "text";
  return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
}

function buildMarkdown(
  site: { siteUrl: string; canonicalHost: string | null; lastScores: unknown },
  job: { id: string; createdAt: Date; completedAt: Date | null },
  actions: AiRepairAction[],
): string {
  const host = site.canonicalHost || site.siteUrl;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const scores = (site.lastScores ?? {}) as Record<string, number>;

  const completed = actions.filter((a) => a.status === "completed");
  const skipped   = actions.filter((a) => a.status === "skipped" || (a.automatedFix as { type?: string } | null)?.type === "manual");
  const failed    = actions.filter((a) => a.status === "failed");

  const lines: string[] = [
    `# Developer Repair Report — ${host}`,
    ``,
    `**Site:** ${site.siteUrl}  `,
    `**Generated:** ${date}  `,
    `**Job ID:** \`${job.id}\``,
    ``,
    `---`,
    ``,
    `## Summary`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Fixes elaborated | **${completed.length}** |`,
    `| Manual fixes (instructions) | ${skipped.length} |`,
    `| Failed | ${failed.length} |`,
    `| SEO Score | ${scores.seo ?? "N/A"} (${grade(scores.seo)}) |`,
    `| Overall Score | ${scores.overall ?? "N/A"} (${grade(scores.overall)}) |`,
    ``,
    `---`,
    ``,
  ];

  // ── Applied Fixes ──────────────────────────────────────────────────────
  if (completed.length > 0) {
    lines.push(`## Applied Fixes (${completed.length})`, ``);

    for (const a of completed) {
      const fix = (a.automatedFix ?? {}) as Record<string, unknown>;
      const summary  = (fix.elaboratedSummary ?? fix.description ?? "") as string;
      const steps    = (fix.elaboratedSteps   ?? [])                    as string[];
      const snippet  = (fix.elaboratedSnippet ?? fix.snippet ?? null)   as string | null;
      const impact   = (fix.expectedImpact    ?? a.impact ?? "")        as string;
      const section  = a.seoSection ?? a.category ?? "";
      const severity = a.severity ?? "medium";

      lines.push(`### ${a.title ?? a.actionId}`);
      lines.push(`**Section:** ${section} · **Severity:** ${severity}`, ``);

      if (summary) lines.push(summary, ``);

      if (steps.length > 0) {
        lines.push(`**Implementation steps:**`, ``);
        steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        lines.push(``);
      }

      if (snippet) {
        lines.push(`**Code snippet:**`, ``, fenceBlock(snippet), ``);
      }

      if (impact) lines.push(`> **Expected impact:** ${impact}`, ``);

      lines.push(`---`, ``);
    }
  }

  // ── Manual Fixes ────────────────────────────────────────────────────────
  if (skipped.length > 0) {
    lines.push(`## Manual Fixes — Action Required (${skipped.length})`, ``);
    lines.push(`These fixes require direct access to your CMS, theme files, or hosting.`, ``);

    for (const a of skipped) {
      const fix = (a.automatedFix ?? {}) as Record<string, unknown>;
      const desc = (fix.description ?? "") as string;
      lines.push(`### ${a.title ?? a.actionId}`);
      lines.push(`**Severity:** ${a.severity ?? "medium"}`, ``);
      if (a.impact) lines.push(a.impact, ``);
      if (desc) lines.push(`**What to do:** ${desc}`, ``);
      lines.push(`---`, ``);
    }
  }

  // ── Failed ──────────────────────────────────────────────────────────────
  if (failed.length > 0) {
    lines.push(`## Failed (${failed.length})`, ``);
    for (const a of failed) {
      lines.push(`- **${a.title ?? a.actionId}** — ${a.errorMessage ?? "Unknown error"}`);
    }
    lines.push(``);
  }

  lines.push(`---`, ``, `*Generated by GetSafe360 AI · ${date}*`);
  return lines.join("\n");
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { jobId?: string };
  if (!body.jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [site] = await db
    .select({
      id: sites.id,
      siteUrl: sites.siteUrl,
      canonicalHost: sites.canonicalHost,
      lastScores: sites.lastScores,
    })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) {
    return NextResponse.json({ error: "SITE_NOT_FOUND" }, { status: 404 });
  }

  const [job] = await db
    .select({ id: aiAnalysisJobs.id, createdAt: aiAnalysisJobs.createdAt, completedAt: aiAnalysisJobs.completedAt })
    .from(aiAnalysisJobs)
    .where(and(eq(aiAnalysisJobs.id, body.jobId), eq(aiAnalysisJobs.siteId, siteId)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "JOB_NOT_FOUND" }, { status: 404 });
  }

  const actions = await db
    .select()
    .from(aiRepairActions)
    .where(
      and(
        eq(aiRepairActions.analysisJobId, body.jobId),
        eq(aiRepairActions.addedToRepairQueue, true),
      ),
    );

  const markdown = buildMarkdown(site, job, actions);

  const safeHost = (site.canonicalHost || site.siteUrl).replace(/[^a-zA-Z0-9]/g, "-");
  const date = new Date().toISOString().split("T")[0];
  const filename = `${safeHost}-dev-report-${date}.md`;

  const blob = await put(
    `dev-reports/${siteId}/${body.jobId}-${date}.md`,
    markdown,
    { contentType: "text/markdown; charset=utf-8", access: "public" },
  );

  return NextResponse.json({ url: blob.url, filename });
}
