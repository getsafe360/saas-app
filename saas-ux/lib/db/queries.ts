// saas-ux/lib/db/queries.ts
import { desc, and, eq, isNull } from 'drizzle-orm';
import { getDb } from './drizzle';
const db = getDb();
import { activityLogs, teamMembers, teams, users, type TeamDataWithMembers } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) return null;

  const sessionData = await verifyToken(sessionCookie.value);
  if (!sessionData || !sessionData.user || typeof sessionData.user.id !== 'number') {
    return null;
  }
  if (new Date(sessionData.expires) < new Date()) return null;

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  return user.length === 0 ? null : user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({ ...subscriptionData, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      team: teams,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.id, userId))
    .limit(1);

  // { user: usersRow, team: teamsRow | null }
  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) throw new Error('User not authenticated');

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

/**
 * Returns the user's team, including members and each member's basic user fields.
 * Typed to match TeamDataWithMembers so middleware.withTeam() type checks.
 */
export async function getTeamForUser(): Promise<TeamDataWithMembers | null> {
  const user = await getUser();
  if (!user) return null;

  // 1) Which team is this user in?
  const membership = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (membership.length === 0) return null;
  const teamId = membership[0].teamId;

  // 2) Load the team row
  const teamRows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (teamRows.length === 0) return null;
  const team = teamRows[0];

  // 3) Load members (include joinedAt + user fields)
  const members = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
      userId: teamMembers.userId,
      teamId: teamMembers.teamId,
      joinedAt: teamMembers.joinedAt, // <- required by TeamDataWithMembers
      user_id: users.id,
      user_name: users.name,
      user_email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  // 4) Shape to TeamDataWithMembers
  const shaped: TeamDataWithMembers = {
    ...team,
    teamMembers: members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      teamId: m.teamId,
      joinedAt: m.joinedAt,
      user: {
        id: m.user_id,
        name: m.user_name,
        email: m.user_email,
      },
    })),
  };

  return shaped;
}
