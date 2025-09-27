// lib/auth/current.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function findCurrentUserTeam(): Promise<
  | { user: typeof users.$inferSelect; team: typeof teams.$inferSelect | null }
  | null
> {
  // Clerk session (await is required in newer Clerk versions)
  const { userId: clerkUserId } = await auth(); // ✅ await
  if (!clerkUserId) return null;

  const db = getDb();

  // Map Clerk → DB user
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!userRow) return null;

  // First team (owner/member)
  const teamJoin = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userRow.id))
    .limit(1);

  const teamRow = teamJoin[0]?.team ?? null;
  return { user: userRow, team: teamRow };
}

export async function findCurrentUser() {
  const cu = await currentUser(); // also async
  if (!cu) return null;

  const db = getDb();
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, cu.id))
    .limit(1);

  return userRow ?? null;
}
