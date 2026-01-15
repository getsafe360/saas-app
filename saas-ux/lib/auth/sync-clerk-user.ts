// lib/auth/sync-clerk-user.ts
'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db/drizzle';
import { users, type NewUser } from '@/lib/db/schema/auth/users';
import { teams, teamMembers, type NewTeam, type NewTeamMember } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';

/**
 * Syncs a Clerk user to the local database.
 * Creates user + team if they don't exist.
 *
 * This is called on first visit after Clerk signup to ensure
 * the user exists in our database before we try to create sites.
 *
 * @returns The app user ID (from our database), or null if failed
 */
export async function syncClerkUserToDatabase(): Promise<number | null> {
  try {
    // Get Clerk user
    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.error('[syncClerkUser] No Clerk user found');
      return null;
    }

    const db = getDb();

    // Check if user already exists in our database
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    if (existingUser) {
      // User already synced
      console.log('[syncClerkUser] User already exists:', existingUser.id);
      return existingUser.id;
    }

    console.log('[syncClerkUser] Creating new user in database for Clerk ID:', clerkUser.id);

    // Get primary email from Clerk
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail) {
      console.error('[syncClerkUser] No primary email found');
      return null;
    }

    // Create user in our database
    const newUser: NewUser = {
      email: primaryEmail.emailAddress,
      passwordHash: '', // Empty - auth handled by Clerk
      role: 'owner',
      language: 'en', // Default, can be updated later
      clerkUserId: clerkUser.id,
      name: clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
        : clerkUser.firstName || primaryEmail.emailAddress.split('@')[0],
    };

    const [createdUser] = await db
      .insert(users)
      .values(newUser)
      .returning();

    if (!createdUser) {
      console.error('[syncClerkUser] Failed to create user');
      return null;
    }

    console.log('[syncClerkUser] User created:', createdUser.id);

    // Create default team for user
    const [createdTeam] = await db
      .insert(teams)
      .values({
        name: `${createdUser.name || createdUser.email}'s Team`,
      } satisfies NewTeam)
      .returning();

    if (!createdTeam) {
      console.error('[syncClerkUser] Failed to create team');
      // User exists but no team - still return user ID
      return createdUser.id;
    }

    console.log('[syncClerkUser] Team created:', createdTeam.id);

    // Add user to team
    const newTeamMember: NewTeamMember = {
      userId: createdUser.id,
      teamId: createdTeam.id,
      role: 'owner',
    };

    await db.insert(teamMembers).values(newTeamMember);

    console.log('[syncClerkUser] User synced successfully:', {
      userId: createdUser.id,
      teamId: createdTeam.id,
      clerkId: clerkUser.id,
    });

    return createdUser.id;
  } catch (error) {
    console.error('[syncClerkUser] Error syncing user:', error);
    return null;
  }
}

/**
 * Gets the app user ID for a Clerk user.
 * If user doesn't exist, creates them first.
 *
 * @returns The app user ID, or null if failed
 */
export async function getOrCreateAppUserId(): Promise<number | null> {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const db = getDb();

    // Try to get existing user
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    if (existingUser) {
      return existingUser.id;
    }

    // User doesn't exist - sync from Clerk
    return await syncClerkUserToDatabase();
  } catch (error) {
    console.error('[getOrCreateAppUserId] Error:', error);
    return null;
  }
}
