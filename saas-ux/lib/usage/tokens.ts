// lib/usage/tokens.ts
// Token usage tracking and management
'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema/auth';
import { calculateAvailableTokens, calculateUsagePercentage, USAGE_THRESHOLDS, getPlan } from '@/lib/plans/config';

export interface TokenBalance {
  tokensIncluded: number; // Monthly allowance
  tokensPurchased: number; // One-time packs (never expire)
  tokensUsedThisMonth: number; // Usage this billing cycle
  tokensAvailable: number; // Calculated: (included + purchased) - used
  usagePercentage: number; // 0-1
  planName: string;
  needsAlert: boolean; // Should show usage warning
}

/**
 * Get token balance for a team
 */
export async function getTokenBalance(teamId: number): Promise<TokenBalance | null> {
  try {
    const db = getDb();
    const [team] = await db
      .select({
        planName: teams.planName,
        tokensIncluded: teams.tokensIncluded,
        tokensPurchased: teams.tokensPurchased,
        tokensUsedThisMonth: teams.tokensUsedThisMonth,
        notifiedAt80Percent: teams.notifiedAt80Percent,
        notifiedAt100Percent: teams.notifiedAt100Percent,
      })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      console.error('[getTokenBalance] Team not found:', teamId);
      return null;
    }

    const tokensAvailable = calculateAvailableTokens(
      team.tokensIncluded,
      team.tokensPurchased,
      team.tokensUsedThisMonth
    );

    const usagePercentage = calculateUsagePercentage(
      team.tokensIncluded,
      team.tokensPurchased,
      team.tokensUsedThisMonth
    );

    // Show alert if usage is high and user hasn't been notified yet
    const needsAlert =
      (usagePercentage >= USAGE_THRESHOLDS.WARNING && !team.notifiedAt80Percent) ||
      (usagePercentage >= USAGE_THRESHOLDS.CRITICAL && !team.notifiedAt100Percent);

    return {
      tokensIncluded: team.tokensIncluded,
      tokensPurchased: team.tokensPurchased,
      tokensUsedThisMonth: team.tokensUsedThisMonth,
      tokensAvailable,
      usagePercentage,
      planName: team.planName || 'free',
      needsAlert,
    };
  } catch (error) {
    console.error('[getTokenBalance] Error:', error);
    return null;
  }
}

/**
 * Check if team has enough tokens for an operation
 */
export async function checkTokenAvailability(
  teamId: number,
  tokensNeeded: number
): Promise<{ available: boolean; balance: TokenBalance | null }> {
  const balance = await getTokenBalance(teamId);

  if (!balance) {
    return { available: false, balance: null };
  }

  return {
    available: balance.tokensAvailable >= tokensNeeded,
    balance,
  };
}

/**
 * Deduct tokens from team balance
 * Returns new balance or null if insufficient tokens
 */
export async function deductTokens(
  teamId: number,
  tokensToDeduct: number,
  reason?: string
): Promise<TokenBalance | null> {
  try {
    const db = getDb();

    // Check if team has enough tokens
    const check = await checkTokenAvailability(teamId, tokensToDeduct);
    if (!check.available || !check.balance) {
      console.error('[deductTokens] Insufficient tokens:', {
        teamId,
        needed: tokensToDeduct,
        available: check.balance?.tokensAvailable,
      });
      return null;
    }

    // Deduct tokens
    const newUsage = check.balance.tokensUsedThisMonth + tokensToDeduct;

    await db
      .update(teams)
      .set({
        tokensUsedThisMonth: newUsage,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    console.log('[deductTokens] Tokens deducted:', {
      teamId,
      amount: tokensToDeduct,
      reason: reason || 'unknown',
      newUsage,
    });

    // Return updated balance
    return await getTokenBalance(teamId);
  } catch (error) {
    console.error('[deductTokens] Error:', error);
    return null;
  }
}

/**
 * Add purchased tokens to team balance
 * These tokens never expire
 */
export async function addPurchasedTokens(
  teamId: number,
  tokensToAdd: number,
  stripePaymentIntentId?: string
): Promise<boolean> {
  try {
    const db = getDb();

    const [team] = await db
      .select({ tokensPurchased: teams.tokensPurchased })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      console.error('[addPurchasedTokens] Team not found:', teamId);
      return false;
    }

    const newTotal = team.tokensPurchased + tokensToAdd;

    await db
      .update(teams)
      .set({
        tokensPurchased: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    console.log('[addPurchasedTokens] Tokens added:', {
      teamId,
      amount: tokensToAdd,
      newTotal,
      paymentIntent: stripePaymentIntentId,
    });

    return true;
  } catch (error) {
    console.error('[addPurchasedTokens] Error:', error);
    return false;
  }
}

/**
 * Update plan and reset monthly tokens
 * Called when subscription changes
 */
export async function updatePlanTokens(
  teamId: number,
  newPlanName: 'free' | 'pro' | 'agency'
): Promise<boolean> {
  try {
    const db = getDb();
    const plan = getPlan(newPlanName);

    await db
      .update(teams)
      .set({
        planName: newPlanName,
        tokensIncluded: plan.tokensIncluded,
        billingCycleStart: new Date(),
        tokensUsedThisMonth: 0, // Reset usage for new plan
        notifiedAt80Percent: false,
        notifiedAt100Percent: false,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    console.log('[updatePlanTokens] Plan updated:', {
      teamId,
      newPlan: newPlanName,
      tokensIncluded: plan.tokensIncluded,
    });

    return true;
  } catch (error) {
    console.error('[updatePlanTokens] Error:', error);
    return false;
  }
}

/**
 * Reset monthly usage for billing cycle
 * Should be called via cron job at the start of each billing cycle
 */
export async function resetMonthlyUsage(teamId: number): Promise<boolean> {
  try {
    const db = getDb();

    await db
      .update(teams)
      .set({
        tokensUsedThisMonth: 0,
        billingCycleStart: new Date(),
        notifiedAt80Percent: false,
        notifiedAt100Percent: false,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId));

    console.log('[resetMonthlyUsage] Monthly usage reset for team:', teamId);
    return true;
  } catch (error) {
    console.error('[resetMonthlyUsage] Error:', error);
    return false;
  }
}

/**
 * Mark notification as sent
 */
export async function markNotificationSent(
  teamId: number,
  threshold: 'warning' | 'critical'
): Promise<boolean> {
  try {
    const db = getDb();

    const updates: any = { updatedAt: new Date() };

    if (threshold === 'warning') {
      updates.notifiedAt80Percent = true;
    } else {
      updates.notifiedAt100Percent = true;
    }

    await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, teamId));

    return true;
  } catch (error) {
    console.error('[markNotificationSent] Error:', error);
    return false;
  }
}

/**
 * Get teams that need usage alerts
 * To be called by a cron job
 */
export async function getTeamsNeedingAlerts(): Promise<Array<{
  teamId: number;
  teamName: string;
  usagePercentage: number;
  alertType: 'warning' | 'critical';
}>> {
  try {
    const db = getDb();

    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        tokensIncluded: teams.tokensIncluded,
        tokensPurchased: teams.tokensPurchased,
        tokensUsedThisMonth: teams.tokensUsedThisMonth,
        notifiedAt80Percent: teams.notifiedAt80Percent,
        notifiedAt100Percent: teams.notifiedAt100Percent,
      })
      .from(teams);

    const needsAlerts = [];

    for (const team of allTeams) {
      const usagePercentage = calculateUsagePercentage(
        team.tokensIncluded,
        team.tokensPurchased,
        team.tokensUsedThisMonth
      );

      // Check if critical alert needed
      if (usagePercentage >= USAGE_THRESHOLDS.CRITICAL && !team.notifiedAt100Percent) {
        needsAlerts.push({
          teamId: team.id,
          teamName: team.name,
          usagePercentage,
          alertType: 'critical' as const,
        });
      }
      // Check if warning alert needed
      else if (usagePercentage >= USAGE_THRESHOLDS.WARNING && !team.notifiedAt80Percent) {
        needsAlerts.push({
          teamId: team.id,
          teamName: team.name,
          usagePercentage,
          alertType: 'warning' as const,
        });
      }
    }

    return needsAlerts;
  } catch (error) {
    console.error('[getTeamsNeedingAlerts] Error:', error);
    return [];
  }
}
