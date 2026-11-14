// lib/ai-visibility/billing.ts
// "Check now" pays up front: the most a run may cost is taken from the team's
// balance before Claude is asked, under the same per-team lock as fix
// proposals, so parallel checks and fixes can never spend the same tokens.
// Afterwards the unused part goes back. A run never costs more than reserved.

import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema/auth';
import { getAvailableTokens, TOKEN_RESERVE_LOCK } from '@/lib/fix/tokens';

/** Takes `amount` from the balance when that much is available. Returns the available balance on failure. */
export async function reserveTokens(teamId: number, amount: number): Promise<{ ok: true } | { ok: false; available: number }> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${TOKEN_RESERVE_LOCK}::int, ${teamId}::int)`);
    const { available } = await getAvailableTokens(teamId, tx);
    if (available < amount) return { ok: false as const, available };
    await tx
      .update(teams)
      .set({ tokensRemaining: sql`${teams.tokensRemaining} - ${amount}` })
      .where(eq(teams.id, teamId));
    return { ok: true as const };
  });
}

/** Charges what the run cost, at most the reservation, and gives the rest back. Returns the charge. */
export async function settleTokens(teamId: number, reserved: number, actual: number): Promise<number> {
  const charge = Math.max(0, Math.min(Math.ceil(actual), reserved));
  await getDb()
    .update(teams)
    .set({
      tokensRemaining: sql`${teams.tokensRemaining} + ${reserved - charge}`,
      tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${charge}`,
    })
    .where(eq(teams.id, teamId));
  return charge;
}
