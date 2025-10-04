// lib/auth/current.ts
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';

export async function clerkUserId(): Promise<string | null> {
  const { userId } = await auth();              // Clerk server-side
  return userId ?? null;
}

export async function getDbUserFromClerk() {
  const clerkId = await clerkUserId();
  if (!clerkId) return null;

  const db = getDb();
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkId))
    .limit(1);

  return u ?? null; // { id, email, clerkUserId, ... } or null
}

export async function findCurrentUserTeam() {
  const u = await getDbUserFromClerk();
  if (!u) return null;

  const db = getDb();
  const row = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, u.id))
    .limit(1);

  return row[0]?.team ?? null; // returns a teams row or null
}
