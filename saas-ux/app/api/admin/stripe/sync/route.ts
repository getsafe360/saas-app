// app/api/admin/stripe/sync/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/authz';
import { syncStripeForPlans, syncStripeForPacks } from '@/lib/server/payments/stripeSync';
import { getDb } from '@/lib/db/conn';
import { adminActions } from '@/lib/db/schema';

export async function POST() {
  try {
    const { me } = await requireAdmin();

    await syncStripeForPlans();
    await syncStripeForPacks();

    const db = getDb();
    await db.insert(adminActions).values({
      actorUserId: me.id,
      targetType: 'billing',
      targetId: 'stripe',
      action: 'stripe_sync',
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'error' }, { status: 400 });
  }
}
