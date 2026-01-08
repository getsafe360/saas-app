// app/api/stripe/webhook/route.ts
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb } from '@/lib/db/drizzle';
import { webhookEvents, teamSubscriptions } from '@/lib/db/schema';
import { plans } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Let Stripe use your account's default API version to avoid TS union mismatches.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// This must be set in your env
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  // In newer Next versions, headers() returns a Promise
  const hdrs = await headers();
  const sig = hdrs.get('stripe-signature');
  if (!sig) {
    return new NextResponse('Missing stripe-signature header', { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, endpointSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const db = getDb();

  // Persist event (idempotent)
  try {
    await db.insert(webhookEvents).values({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      payload: event as any, // JSONB column expected
      status: 'stored',
    });
  } catch {
    // likely a duplicate eventId -> ignore
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const mode = s.mode;
        const subId = s.subscription as string | null;
        const custId = s.customer as string | null;
        const meta = (s.metadata as Record<string, string> | null) || {};
        const teamId = meta.team_id ? Number(meta.team_id) : undefined;

        if (mode === 'subscription' && subId && custId && teamId) {
          const planSlug = meta.plan_slug as string | undefined;
          if (!planSlug) break;

          const [pl] = await db.select().from(plans).where(eq(plans.slug, planSlug)).limit(1);
          if (!pl) break;

          await db
            .insert(teamSubscriptions)
            .values({
              teamId,
              planId: pl.id,
              status: 'active',
              stripeCustomerId: custId,
              stripeSubscriptionId: subId,
            })
            .onConflictDoUpdate({
              target: [teamSubscriptions.teamId, teamSubscriptions.stripeSubscriptionId],
              set: { status: 'active' },
            });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status; // 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | ...
        const subId = sub.id;

        // In some Stripe type versions, these epoch fields may not be in the TS defs:
        const currentPeriodEnd = (sub as any).current_period_end as number | undefined;
        const cancelAt = (sub as any).cancel_at as number | undefined;

        await db
          .update(teamSubscriptions)
          .set({
            status: mapStripeSubStatus(status),
            currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
            cancelAt: cancelAt ? new Date(cancelAt * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(teamSubscriptions.stripeSubscriptionId, subId));
        break;
      }

      // Handle more events as needed (invoice.payment_failed, etc.)
    }

    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)));
  } catch (err: any) {
    await db
      .update(webhookEvents)
      .set({ status: 'error', errorMessage: err?.message ?? 'error', processedAt: new Date() })
      .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)));

    return new NextResponse('Webhook handler error', { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapStripeSubStatus(s: Stripe.Subscription.Status) {
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'canceled':
      return 'canceled';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'past_due';
    default:
      return 'active';
  }
}
