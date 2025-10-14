// lib/db/queries/teams.ts
import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '../drizzle';
import { teams } from '../schema';

export async function getTeamByStripeCustomerId(customerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateTeamSubscription(
  teamId: number,
  data: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string; // e.g. 'active' | 'trialing' | 'canceled' | 'unpaid'
  }
) {
  const db = getDb();
  await db
    .update(teams)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}
