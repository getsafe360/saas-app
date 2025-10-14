// lib/server/authz.ts
import { getDb } from '@/lib/db/conn'; // your helper
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs'; // or your session helper

export async function requireAdmin() {
  const { userId: clerkUserId } = auth(); // adapt to your session method
  if (!clerkUserId) throw new Error('Unauthorized');

  const db = getDb();
  const [me] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  if (!me) throw new Error('Unauthorized');

  const allowed = me.role === 'admin' || me.role === 'staff';
  if (!allowed) throw new Error('Forbidden');
  return { me };
}
// You can add more helpers, e.g. requireStaff(), requirePlan(), etc.