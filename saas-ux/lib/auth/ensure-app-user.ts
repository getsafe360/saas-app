import 'server-only';

import crypto from 'crypto';
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/auth/users';
import { getUser } from '@/lib/db/queries';
import { hashPassword } from '@/lib/auth/session';
import { detectVisitorLocale } from '@/i18n/resolve-locale';
import { sendWelcomeToNewUser } from '@/lib/email/welcome';
import { ensureTeamForUser } from '@/lib/auth/provision';

/**
 * Returns the app user id for the current request.
 * - Uses local session user when available.
 * - Falls back to Clerk identity.
 * - Auto-provisions a DB user from Clerk profile on first authenticated request.
 */
export async function ensureAppUserId(): Promise<number | null> {
  const db = getDb();

  try {
    const localUser = await getUser();
    if (localUser?.id) return localUser.id;
  } catch {
    // Ignore local session failures and continue with Clerk identity.
  }

  const clerkUser = await currentUser().catch(() => null);
  if (!clerkUser) return null;

  const primaryEmail =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    `user-${clerkUser.id}@example.invalid`;

  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
  const name = displayName || primaryEmail.split('@')[0];

  const [mappedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1);

  if (mappedUser?.id) {
    // The user row can exist before its team does (a parallel request is still
    // provisioning it, or it failed part-way), so make sure the team is there too.
    // Cheap when it already exists: ensureTeamForUser short-circuits on a lookup.
    await ensureTeamForUser(mappedUser.id, name);
    return mappedUser.id;
  }

  // ON CONFLICT DO NOTHING: when two requests provision the same Clerk user at
  // once, exactly one insert wins and the other gets no row (instead of throwing
  // a duplicate-key error). Drizzle wraps Postgres errors, so a catch on
  // `error.code` would never match anyway.
  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name,
      passwordHash: await hashPassword(crypto.randomUUID()),
      role: 'member',
      language: await detectVisitorLocale(),
    } as any)
    .onConflictDoNothing()
    .returning({ id: users.id, email: users.email, name: users.name, language: users.language });

  let userId: number | null = created?.id ?? null;

  if (!created) {
    // Lost the race to another request, or a pre-Clerk row already owns this email.
    const [byClerkId] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    if (byClerkId) {
      userId = byClerkId.id;
    } else {
      const [linked] = await db
        .update(users)
        .set({ clerkUserId: clerkUser.id })
        .where(eq(users.email, primaryEmail))
        .returning({ id: users.id });
      userId = linked?.id ?? null;
    }
  }

  // Team first: the welcome email is slow, and other requests that already see
  // the user row must not find it without a team in the meantime.
  if (userId) await ensureTeamForUser(userId, name);

  // Only the request whose insert succeeded sends the welcome email.
  if (created) await sendWelcomeToNewUser(created);

  return userId;
}
