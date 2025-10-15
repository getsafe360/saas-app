// saas-ux/app/(login)/actions.ts
'use server';

import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { randomUUID } from 'crypto';
const db = getDb();

import {
  // data + tables
  users,
  teams,
  teamMembers,
  invitations,
  activityLogs,
  // inserts
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
} from '@/lib/db/schema';

import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';

/** ---------------------------------------------------------
 * Logging helper
 * --------------------------------------------------------- */

type UserActivity =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'UPDATE_PASSWORD'
  | 'DELETE_ACCOUNT'
  | 'UPDATE_ACCOUNT'
  | 'CREATE_TEAM'
  | 'REMOVE_TEAM_MEMBER'
  | 'INVITE_TEAM_MEMBER'
  | 'ACCEPT_INVITATION';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: UserActivity,
  ipAddress?: string,
  extra?: Record<string, unknown>
) {
  if (teamId == null) return;

  const entry: NewActivityLog = {
    userId,
    teamId,
    event: 'site_updated',
    data: { kind: 'user', action: type, ...(extra ?? {}) },
    ipAddress: ipAddress ?? null,
  };

  await db.insert(activityLogs).values(entry);
}

/** ------------------------ Sign In ------------------------ */

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const userWithTeam = await db
    .select({ user: users, team: teams })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1);

  if (userWithTeam.length === 0) {
    return { error: 'Invalid email or password. Please try again.', email, password };
  }

  const { user: foundUser, team: foundTeam } = userWithTeam[0];

  const isPasswordValid = await comparePasswords(password, foundUser.passwordHash);
  if (!isPasswordValid) {
    return { error: 'Invalid email or password. Please try again.', email, password };
  }

  await Promise.all([setSession(foundUser), logActivity(foundTeam?.id, foundUser.id, 'SIGN_IN')]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: foundTeam, priceId });
  }

  redirect('/dashboard');
});

/** ------------------------ Sign Up ------------------------ */

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser.length > 0) {
    return { error: 'Failed to create user. Please try again.', email, password };
  }

  const passwordHash = await hashPassword(password);
  const authRes = await auth();
  const clerkId = authRes?.userId ?? `local-${randomUUID()}`;

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner', // schema default is 'member' if omitted
    language: 'en',
    clerkUserId: clerkId,
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();
  if (!createdUser) {
    return { error: 'Failed to create user. Please try again.', email, password };
  }

  let teamId: number;
  let userRole: string;
  let createdTeam: typeof teams.$inferSelect | null = null;

  if (inviteId) {
    // Accept invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId, 10)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (!invitation) {
      return { error: 'Invalid or expired invitation.', email, password };
    }

    teamId = invitation.teamId;
    userRole = invitation.role;

    await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, invitation.id));
    await logActivity(teamId, createdUser.id, 'ACCEPT_INVITATION');

    [createdTeam] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  } else {
    // Create new team
    const [team] = await db
      .insert(teams)
      .values({ name: `${email}'s Team` satisfies NewTeam['name'] })
      .returning();
    if (!team) {
      return { error: 'Failed to create team. Please try again.', email, password };
    }
    createdTeam = team;
    teamId = team.id;
    userRole = 'owner';

    await logActivity(teamId, createdUser.id, 'CREATE_TEAM');
  }

  const newTeamMember: NewTeamMember = { userId: createdUser.id, teamId, role: userRole };

  await Promise.all([
    db.insert(teamMembers).values(newTeamMember),
    logActivity(teamId, createdUser.id, 'SIGN_UP'),
    setSession(createdUser),
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: createdTeam, priceId });
  }

  redirect('/dashboard');
});

/** ------------------------ Sign Out ------------------------ */

export async function signOut() {
  const user = await getUser();
  if (!user) return;
  const userWithTeam = await getUserWithTeam(user.id);
  await logActivity(userWithTeam?.team?.id, user.id, 'SIGN_OUT');
  (await cookies()).delete('session');
}

/** --------------------- Update Password ------------------- */

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, sessionUser) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    // Fetch full DB user to access passwordHash
    const [dbUser] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!dbUser) {
      return { currentPassword, newPassword, confirmPassword, error: 'User not found.' };
    }

    const isPasswordValid = await comparePasswords(currentPassword, dbUser.passwordHash);
    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.',
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.',
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.',
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(sessionUser.id);

    await Promise.all([
      db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, sessionUser.id)),
      logActivity(userWithTeam?.team?.id, sessionUser.id, 'UPDATE_PASSWORD'),
    ]);

    return { success: 'Password updated successfully.' };
  },
);

/** ---------------------- Delete Account ------------------- */

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, sessionUser) => {
    const { password } = data;

    // Fetch full DB user to access passwordHash
    const [dbUser] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!dbUser) {
      return { password, error: 'User not found.' };
    }

    const isPasswordValid = await comparePasswords(password, dbUser.passwordHash);
    if (!isPasswordValid) {
      return { password, error: 'Incorrect password. Account deletion failed.' };
    }

    const userWithTeam = await getUserWithTeam(sessionUser.id);
    await logActivity(userWithTeam?.team?.id, sessionUser.id, 'DELETE_ACCOUNT');

    // Soft delete + keep email unique
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')`,
      })
      .where(eq(users.id, sessionUser.id));

    if (userWithTeam?.team?.id) {
      await db
        .delete(teamMembers)
        .where(and(eq(teamMembers.userId, sessionUser.id), eq(teamMembers.teamId, userWithTeam.team.id)));
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  },
);

/** --------------------- Update Account -------------------- */

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, sessionUser) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(sessionUser.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, sessionUser.id)),
      logActivity(userWithTeam?.team?.id, sessionUser.id, 'UPDATE_ACCOUNT'),
    ]);

    return { name, success: 'Account updated successfully.' };
  },
);

/** -------------------- Remove Team Member ----------------- */

const removeTeamMemberSchema = z.object({
  memberId: z.number(),
});

export const removeTeamMember = validatedActionWithUser
