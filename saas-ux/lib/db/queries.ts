// saas-ux/lib/db/queries.ts
import { desc, and, eq, isNull } from 'drizzle-orm';
import { getDb } from './drizzle';
const db = getDb();

import {
  activityLogs,
  users,
  teams,
  teamMembers,
  type TeamDataWithMembers,
} from './schema';
import { cookies as nextCookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

// Handles both sync and async cookies() implementations
async function getSessionCookie() {
  const jarOrPromise = (nextCookies as unknown as () => any)();
  const jar = typeof (jarOrPromise?.then) === 'function' ? await jarOrPromise : jarOrPromise;
  return jar?.get?.('session') ?? null;
}

/** Current session's user (or null). */
export async function getUser() {
  const sessionCookie = await getSessionCookie();  // <-- changed
  if (!sessionCookie || !sessionCookie.value) return null;

  const sessionData = await verifyToken(sessionCookie.value);
  if (!sessionData || !sessionData.user || typeof sessionData.user.id !== 'number') return null;
  if (new Date(sessionData.expires) < new Date()) return null;

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  return user.length === 0 ? null : user[0];
}

/** Optional legacy helpers (safe no-ops if you don't use teams now). */
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

/** Keep signature for existing imports — returns { user, team: null } if no team. */
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

  if (!result[0]) return { user: undefined as any, team: null as any };
  const { user, team } = result[0];
  return { user, team: team ?? null };
}

/** Recent activity (user-scoped; no team required). */
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
 * Legacy compatibility for middleware.withTeam():
 * If you’re not using teams, just return null.
 */
export async function getTeamForUser(): Promise<TeamDataWithMembers | null> {
  return null;
}
