import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema/auth';
import { tokenTransactions } from '@/lib/db/schema';
import {
  DEFAULT_AUTO_REPLENISH_PACK_ID,
  getTokenPackById,
  TOKEN_PACKS,
  type TokenPackDefinition,
} from '@/config/billing/token-packs';
import { PRO_PLAN_PRICE_EUR } from '@/config/billing/plans';

const AUTO_REPLENISH_THRESHOLD_PERCENT = 0.2;

function toNumericString(value: number) {
  return value.toFixed(2);
}

export async function recordTokenPurchase(params: {
  teamId: number;
  pack: TokenPackDefinition;
  amountEur: number;
  stripePaymentId?: string;
  type?: 'purchase' | 'auto_replenish';
}) {
  const db = getDb();
  const type = params.type ?? 'purchase';

  await db.transaction(async (tx) => {
    await tx.insert(tokenTransactions).values({
      teamId: params.teamId,
      amountTokens: params.pack.tokens,
      amountEur: toNumericString(params.amountEur),
      stripePaymentId: params.stripePaymentId,
      type,
    });

    await tx
      .update(teams)
      .set({
        tokensRemaining: sql`${teams.tokensRemaining} + ${params.pack.tokens}`,
        tokensPurchased: sql`${teams.tokensPurchased} + ${params.pack.tokens}`,
        tokensPurchasedThisMonth: sql`${teams.tokensPurchasedThisMonth} + ${params.pack.tokens}`,
        tokensPurchasedThisMonthEur: sql`${teams.tokensPurchasedThisMonthEur} + ${toNumericString(params.amountEur)}`,
        showLowTokenBanner: false,
        lastPurchasedPackId: params.pack.id,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, params.teamId));
  });
}

export async function recordTokenBurn(params: {
  teamId: number;
  tokensToBurn: number;
}) {
  const db = getDb();
  const burnAmount = Math.abs(params.tokensToBurn);

  await db.transaction(async (tx) => {
    await tx.insert(tokenTransactions).values({
      teamId: params.teamId,
      amountTokens: -burnAmount,
      type: 'burn',
    });

    await tx
      .update(teams)
      .set({
        tokensRemaining: sql`GREATEST(0, ${teams.tokensRemaining} - ${burnAmount})`,
        tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${burnAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, params.teamId));
  });

  await maybeHandleAutoReplenish(params.teamId);
}

export async function maybeHandleAutoReplenish(teamId: number) {
  const db = getDb();

  const [team] = await db
    .select({
      id: teams.id,
      planName: teams.planName,
      tokensIncluded: teams.tokensIncluded,
      tokensRemaining: teams.tokensRemaining,
      autoReplenishEnabled: teams.autoReplenishEnabled,
      lastPurchasedPackId: teams.lastPurchasedPackId,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team || team.planName !== 'free') return;

  const fallbackPack = getTokenPackById(team.lastPurchasedPackId) ?? getTokenPackById(DEFAULT_AUTO_REPLENISH_PACK_ID);
  if (!fallbackPack) return;

  const thresholdBase = Math.max(team.tokensIncluded, fallbackPack.tokens);
  const threshold = thresholdBase * AUTO_REPLENISH_THRESHOLD_PERCENT;

  if (!(team.tokensRemaining < threshold)) return;

  if (!team.autoReplenishEnabled) {
    await db.update(teams).set({ showLowTokenBanner: true, updatedAt: new Date() }).where(eq(teams.id, teamId));
    return;
  }

  await recordTokenPurchase({
    teamId,
    pack: fallbackPack,
    amountEur: fallbackPack.priceEur,
    type: 'auto_replenish',
  });
}

export async function getPricingSignals(teamId: number) {
  const db = getDb();
  const [team] = await db
    .select({
      planName: teams.planName,
      tokensRemaining: teams.tokensRemaining,
      tokensIncluded: teams.tokensIncluded,
      showLowTokenBanner: teams.showLowTokenBanner,
      autoReplenishEnabled: teams.autoReplenishEnabled,
      tokensPurchasedThisMonthEur: teams.tokensPurchasedThisMonthEur,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return null;

  const tokensPurchasedThisMonthEur = Number(team.tokensPurchasedThisMonthEur ?? 0);

  return {
    planName: team.planName,
    tokensRemaining: team.tokensRemaining,
    showLowTokenBanner: team.showLowTokenBanner,
    autoReplenishEnabled: team.autoReplenishEnabled,
    tokensPurchasedThisMonthEur,
    shouldSuggestProUpgrade: team.planName === 'free' && tokensPurchasedThisMonthEur >= PRO_PLAN_PRICE_EUR,
  };
}

export function getApproxFixes(tokens: number, tokensPerFixUnit: number) {
  return Math.floor(tokens / tokensPerFixUnit);
}

export function getDefaultTokenPack() {
  return TOKEN_PACKS.find((pack) => pack.id === DEFAULT_AUTO_REPLENISH_PACK_ID) ?? TOKEN_PACKS[0];
}
