import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams, teamMembers, type NewTeam } from '@/lib/db/schema/auth';

/**
 * Returns the team id for a user, creating a team (and owner membership) if the
 * user has none.
 *
 * Right after sign-up several requests can provision the same user at once (the
 * welcome page, /api/auth/sync, /api/sites …). A plain "check, then insert" lets
 * each of them create its own team, so the check and insert run in one
 * transaction behind a per-user advisory lock: concurrent callers queue up and
 * the later ones find the team the first one created.
 */
export async function ensureTeamForUser(userId: number, displayName: string): Promise<number | null> {
  const db = getDb();

  // Fast path (the common case, and this runs on hot routes): no lock needed
  // when the team already exists.
  const [existing] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  if (existing) return existing.teamId;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId}::bigint)`);

    const [member] = await tx
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    if (member) return member.teamId;

    const [team] = await tx
      .insert(teams)
      .values({
        name: `${displayName}'s Team`,
        planName: 'free',
        subscriptionStatus: 'active',
        tokensIncluded: 5000,
        tokensUsedThisMonth: 0,
        tokensPurchased: 0,
        billingCycleStart: new Date(),
        notifiedAt80Percent: false,
        notifiedAt100Percent: false,
      } satisfies NewTeam)
      .returning({ id: teams.id });
    if (!team) return null;

    await tx.insert(teamMembers).values({ userId, teamId: team.id, role: 'owner' });
    return team.id;
  });
}
