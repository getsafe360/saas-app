// lib/auth/current.ts
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/auth/users';
import { teams, teamMembers } from '@/lib/db/schema/auth';

export async function clerkUserId(): Promise<string | null> {
  const { userId } = await auth();              // Clerk server-side
  return userId ?? null;
}

// Pure read — never writes. Call POST /api/auth/sync to provision a new user.
export async function getDbUserFromClerk() {
  const clerkId = await clerkUserId();
  if (!clerkId) return null;

  const db = getDb();
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkId))
    .limit(1);

  return u ?? null;
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
