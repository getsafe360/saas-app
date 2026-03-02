import 'server-only';

import crypto from 'crypto';
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/auth/users';
import { getUser } from '@/lib/db/queries';
import { hashPassword } from '@/lib/auth/session';

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

  const [mappedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1);

  if (mappedUser?.id) return mappedUser.id;

  const primaryEmail =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    `user-${clerkUser.id}@example.invalid`;

  const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();

  try {
    const [created] = await db
      .insert(users)
      .values({
        clerkUserId: clerkUser.id,
        email: primaryEmail,
        name: displayName || primaryEmail.split('@')[0],
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: 'member',
        language: 'en',
      } as any)
      .returning({ id: users.id });

    return created?.id ?? null;
  } catch (insertError: any) {
    // Existing email row can happen on migrations from pre-Clerk accounts.
    if (insertError?.code === '23505' && insertError?.constraint === 'users_email_unique') {
      const [updated] = await db
        .update(users)
        .set({ clerkUserId: clerkUser.id })
        .where(eq(users.email, primaryEmail))
        .returning({ id: users.id });

      return updated?.id ?? null;
    }

    throw insertError;
  }
}

