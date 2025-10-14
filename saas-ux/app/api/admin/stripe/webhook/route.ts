// app/api/stripe/webhook/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb } from '@/lib/db/conn';
import {
  webhookEvents, teamSubscriptions, plans, planPrices,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  const sig = headers().get('stripe-signature') as string;
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
      payload: event as any,
      status: 'stored',
    });
  } catch {
    // duplicate => ignore
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const mode = s.mode;
        const subId = s.subscription as string | null;
        const custId = s.customer as string | null;
        const meta = s.metadata || {};
        const teamId = meta.team_id ? Number(meta.team_id) : undefined;

        if (mode === 'subscription' && subId && custId && teamId) {
          // Plan lookup: passed in metadata for clarity
          const planSlug = meta.plan_slug as string | undefined;
          if (!planSlug) break;
          const [pl] = await db.select().from(plans).where(eq(plans.slug, planSlug));
          if (!pl) break;

          await db.insert(teamSubscriptions).values({
            teamId,
            planId: pl.id,
            status: 'active',
            stripeCustomerId: custId,
            stripeSubscriptionId: subId,
          }).onConflictDoUpdate({
            target: [teamSubscriptions.teamId, teamSubscriptions.stripeSubscriptionId],
            set: { status: 'active' }
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status; // trialing, active, past_due, canceled, unpaid, incomplete
        const subId = sub.id;

        await db.update(teamSubscriptions)
          .set({
            status: mapStripeSubStatus(status),
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(teamSubscriptions.stripeSubscriptionId, subId));
        break;
      }
      // You can handle invoice.payment_failed etc. similarly
    }

    await db.update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)));

  } catch (err: any) {
    await db.update(webhookEvents)
      .set({ status: 'error', errorMessage: err?.message ?? 'error', processedAt: new Date() })
      .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)));
    return new NextResponse('Webhook handler error', { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapStripeSubStatus(s: Stripe.Subscription.Status) {
  switch (s) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'canceled': return 'canceled';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'past_due';
    default: return 'active';
  }
}
// Note: you can handle more events, e.g. invoice.payment_failed, customer.deleted, etc.
// See https://stripe.com/docs/webhooks/events for details
