// lib/db/queries/users.ts
import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '../drizzle';
import { users, teams, teamMembers } from '../schema';

// Minimal team type for legacy compatibility (extend if you re-enable teams)
export type TeamDataWithMembers =
  (typeof teams.$inferSelect) & {
    members?: Array<{
      id: number;
      userId: number;
      teamId: number;
      role: string;
    }>;
  };

export async function getUserWithTeam(userId: number) {
  const db = getDb();
  const result = await db
    .select({ user: users, team: teams })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!result[0]) return { user: undefined as any, team: null as any };
  const { user, team } = result[0];
  return { user, team: team ?? null };
}

// Legacy compatibility for middleware.withTeam(); return null until teams are enabled.
export async function getTeamForUser(): Promise<TeamDataWithMembers | null> {
  return null;
}
