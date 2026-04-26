// lib/ai/models.ts
// Model registry — single source of truth for AI model selection per tier.
// Business (BSB) tier → Claude Opus 4.7 with extended thinking
// All other tiers   → existing Gemini / OpenAI paths

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { auth } from "@clerk/nextjs/server";
import { getDrizzle } from "@/lib/db/postgres";
import { users } from "@/lib/db/schema/auth/users";
import { teamMembers, teams } from "@/lib/db/schema/auth/teams";
import { eq } from "drizzle-orm";
import type { PlanName } from "@/lib/plans/config";

export const AGENT_NAME = "Sparky";

// Claude Opus 4.7 — used for BSB tier SEO-GEO deep audits
export const OPUS_MODEL_ID = "claude-opus-4-7";

// Extended thinking token budget for BSB audits (balanced depth vs. latency)
export const OPUS_THINKING_BUDGET = 10_000;

export type AITier = PlanName;

/**
 * Resolve the calling user's plan tier from Clerk session → DB.
 * Falls back to 'free' if anything is unresolvable.
 */
export async function getUserTier(): Promise<AITier> {
  try {
    const { userId } = await auth();
    if (!userId) return "free";

    const db = getDrizzle();

    // Resolve internal user → team membership → team plan
    const [row] = await db
      .select({ planName: teams.planName })
      .from(users)
      .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    const plan = row?.planName as PlanName | undefined;
    if (plan && ["free", "pro", "agent", "agency", "business"].includes(plan)) {
      return plan;
    }
    return "free";
  } catch {
    return "free";
  }
}

/**
 * Returns true when the tier qualifies for Claude Opus (BSB/Business tier).
 */
export function isBSBTier(tier: AITier): boolean {
  return tier === "business";
}

/**
 * Returns the SEO-GEO analysis model for the given tier.
 * Business → Claude Opus 4.7
 * Others   → GPT-4o-mini (fast, sufficient for standard analysis)
 */
export function getSeoAnalysisModel(tier: AITier): LanguageModelV1 {
  if (isBSBTier(tier)) {
    return anthropic(OPUS_MODEL_ID);
  }
  return openai(process.env.MODEL ?? "gpt-4o-mini");
}

/**
 * Provider options for streamText — injects extended thinking for BSB,
 * and standard options for other tiers.
 */
export function getSeoProviderOptions(tier: AITier) {
  if (isBSBTier(tier)) {
    return {
      anthropic: {
        thinking: { type: "enabled" as const, budgetTokens: OPUS_THINKING_BUDGET },
      },
    };
  }
  return {};
}

/**
 * Human-readable model label shown in the UI token counter / badges.
 */
export function getModelLabel(tier: AITier): string {
  return isBSBTier(tier) ? `Claude Opus 4.7` : "Standard AI";
}

/**
 * Approximate token cost per SEO-GEO analysis by tier.
 * BSB uses Opus which is ~4× more expensive per token.
 */
export const ANALYSIS_TOKEN_COST: Record<AITier, number> = {
  free: 2_000,
  pro: 2_000,
  agent: 3_000,
  agency: 3_000,
  business: 8_000,
};
