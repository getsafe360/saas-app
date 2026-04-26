// lib/ai/models.ts
// Server-only model registry — tier resolution and model selection.
// Import AGENT_NAME and pure constants from ./constants instead.
import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { auth } from "@clerk/nextjs/server";
import { getDrizzle } from "@/lib/db/postgres";
import { users } from "@/lib/db/schema/auth/users";
import { teamMembers, teams } from "@/lib/db/schema/auth/teams";
import { eq } from "drizzle-orm";
import type { PlanName } from "@/lib/plans/config";
import {
  OPUS_MODEL_ID,
  OPUS_THINKING_BUDGET,
  ANALYSIS_TOKEN_COST,
} from "./constants";

export type AITier = PlanName;

// Re-export constants so existing imports from "@/lib/ai/models" keep working
export { AGENT_NAME, OPUS_MODEL_ID, OPUS_THINKING_BUDGET, ANALYSIS_TOKEN_COST } from "./constants";

/**
 * Resolve the calling user's plan tier from Clerk session → DB.
 * Falls back to 'free' if anything is unresolvable.
 */
export async function getUserTier(): Promise<AITier> {
  try {
    const { userId } = await auth();
    if (!userId) return "free";

    const db = getDrizzle();

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

export function isBSBTier(tier: AITier): boolean {
  return tier === "business";
}

export function getSeoAnalysisModel(tier: AITier): LanguageModel {
  // Cast needed: @ai-sdk/anthropic@3.x returns LanguageModelV3 but ai@5 beta types declare LanguageModelV2
  if (isBSBTier(tier)) {
    return anthropic(OPUS_MODEL_ID) as unknown as LanguageModel;
  }
  return openai(process.env.MODEL ?? "gpt-4o-mini") as unknown as LanguageModel;
}

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

export function getModelLabel(tier: AITier): string {
  return isBSBTier(tier) ? `Claude Opus 4.7` : "Standard AI";
}
