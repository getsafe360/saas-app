// app/api/team/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema/auth';
import { getDbUserFromClerk } from '@/lib/auth/current';
import { PRO_PLAN_PRICE_EUR } from '@/config/billing/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const db = getDb();

  const dbUser = await getDbUserFromClerk();
  if (!dbUser) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  const row = await db
    .select({
      tokensRemaining: teams.tokensRemaining,
      planName: teams.planName,
      showLowTokenBanner: teams.showLowTokenBanner,
      tokensPurchasedThisMonthEur: teams.tokensPurchasedThisMonthEur,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, dbUser.id))
    .limit(1);

  const team = row[0];
  const purchasedEur = Number(team?.tokensPurchasedThisMonthEur ?? 0);

  return NextResponse.json({
    tokensRemaining: team?.tokensRemaining ?? 0,
    planName: team?.planName ?? 'free',
    showLowTokenBanner: Boolean(team?.showLowTokenBanner),
    tokensPurchasedThisMonthEur: purchasedEur,
    shouldSuggestProUpgrade: (team?.planName ?? 'free') === 'free' && purchasedEur >= PRO_PLAN_PRICE_EUR,
  });
}
