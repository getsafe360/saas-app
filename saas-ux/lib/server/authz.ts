// lib/server/authz.ts
import 'server-only';
import { getDb } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function requireAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error('Unauthorized');

  const db = getDb();
  const [me] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!me) throw new Error('Unauthorized');

  const allowed = me.role === 'admin' || me.role === 'staff';
  if (!allowed) throw new Error('Forbidden');

  return { me };
}
