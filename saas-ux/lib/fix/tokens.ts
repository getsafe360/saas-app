// lib/fix/tokens.ts
//
// Token escrow helpers.
//
// teams.tokensRemaining is the authoritative balance. Held tokens (fix jobs
// waiting for approval) are *not* subtracted from it — otherwise a user who
// never clicks Apply would silently lose their balance. Instead the available
// balance is computed as `tokensRemaining - sum(hold_tokens where pending)`,
// so a pending proposal reserves capacity without spending it.

import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { teams } from '@/lib/db/schema/auth';

export async function getHeldTokens(teamId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ held: sql<number>`coalesce(sum(${fixJobs.holdTokens}), 0)::int` })
    .from(fixJobs)
    .where(and(eq(fixJobs.teamId, teamId), eq(fixJobs.approvalState, 'pending')));
  return row?.held ?? 0;
}

export async function getAvailableTokens(teamId: number): Promise<{
  balance: number;
  held: number;
  available: number;
}> {
  const db = getDb();
  const [team] = await db
    .select({ tokensRemaining: teams.tokensRemaining })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  const balance = team?.tokensRemaining ?? 0;
  const held = await getHeldTokens(teamId);
  return { balance, held, available: Math.max(0, balance - held) };
}
