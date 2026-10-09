// app/api/stripe/webhook/route.ts
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb } from '@/lib/db/drizzle';
import { webhookEvents, tokenTransactions } from '@/lib/db/schema';
import { teamSubscriptions } from '@/lib/db/schema';
import { plans } from '@/lib/db/schema/billing/plans';
import { teams } from '@/lib/db/schema/auth';
import { and, eq, sql } from 'drizzle-orm';
import { PLANS, type PlanName } from '@/lib/plans/config';
import { recordTokenPurchase } from '@/lib/usage/token-transactions';
import { getTokenPackById } from '@/config/billing/token-packs';
import { sendSubscriptionConfirmationEmail, sendPaymentReceiptEmail } from '@/lib/email/send';
import { users } from '@/lib/db/schema/auth/users';
import { teamMembers } from '@/lib/db/schema/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use account default API version to avoid TS union mismatches
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  // Newer Next can return a Promise here
  const hdrs = await headers();
  const sig = hdrs.get('stripe-signature');
  if (!sig) return new NextResponse('Missing stripe-signature header', { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, endpointSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const db = getDb();

  // Persist event. A duplicate eventId means Stripe is retrying: if we already
  // processed it, acknowledge without re-running handlers (they grant tokens and
  // entitlements). Events stuck in 'stored'/'error' are reprocessed.
  try {
    await db.insert(webhookEvents).values({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      payload: event as any, // JSONB column expected
      status: 'stored',
    });
  } catch {
    const [prior] = await db
      .select({ status: webhookEvents.status })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, 'stripe'), eq(webhookEvents.eventId, event.id)))
      .limit(1);
    if (prior?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true });
    }
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

          if (planSlug) {
            const [pl] = await db.select().from(plans).where(eq(plans.slug, planSlug)).limit(1);
            if (pl) {
              // team_subscriptions has no unique index on (team_id, stripe_subscription_id),
              // so ON CONFLICT would be rejected by Postgres; look the row up instead.
              const [existingSub] = await db
                .select({ id: teamSubscriptions.id })
                .from(teamSubscriptions)
                .where(
                  and(
                    eq(teamSubscriptions.teamId, teamId),
                    eq(teamSubscriptions.stripeSubscriptionId, subId),
                  ),
                )
                .limit(1);

              if (existingSub) {
                await db
                  .update(teamSubscriptions)
                  .set({ planId: pl.id, status: 'active', updatedAt: new Date() })
                  .where(eq(teamSubscriptions.id, existingSub.id));
              } else {
                await db.insert(teamSubscriptions).values({
                  teamId,
                  planId: pl.id,
                  status: 'active',
                  stripeCustomerId: custId,
                  stripeSubscriptionId: subId,
                });
              }
            }
          }

          if (planSlug) {
            // Grant the plan's monthly quota. Applied as a delta against the
            // current quota so a retried webhook is a no-op and existing usage
            // and purchased tokens are preserved.
            const quota = PLANS[planSlug as PlanName]?.tokensIncluded;
            await db
              .update(teams)
              .set({
                planName: planSlug,
                subscriptionStatus: 'active',
                stripeCustomerId: custId,
                stripeSubscriptionId: subId,
                ...(quota
                  ? {
                      tokensRemaining: sql`GREATEST(0, ${teams.tokensRemaining} + ${quota} - ${teams.tokensIncluded})`,
                      tokensIncluded: quota,
                    }
                  : {}),
                updatedAt: new Date(),
              })
              .where(eq(teams.id, teamId));

            // Subscription confirmation email
            const owner = await db
              .select({ email: users.email, name: users.name })
              .from(teamMembers)
              .innerJoin(users, eq(teamMembers.userId, users.id))
              .where(eq(teamMembers.teamId, teamId))
              .limit(1)
              .then((r) => r[0] ?? null);
            if (owner) {
              const [pl2] = await db.select().from(plans).where(eq(plans.slug, planSlug)).limit(1);
              const [teamRow] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
              sendSubscriptionConfirmationEmail({
                to: owner.email,
                firstName: (owner.name ?? owner.email).split(' ')[0],
                planName: pl2?.name ?? planSlug,
                billingAmount: s.amount_total
                  ? new Intl.NumberFormat('en', {
                      style: 'currency',
                      currency: (s.currency ?? 'eur').toUpperCase(),
                    }).format(s.amount_total / 100)
                  : '',
                billingPeriod: meta.billing === 'yearly' ? 'year' : 'month',
                tokenBalance: (teamRow?.tokensIncluded ?? 0).toLocaleString('en'),
                nextRenewalDate: '',
              }).catch((e) => console.error('[webhook] subscription confirmation email failed', e));
            }
          }
        }

        if (mode === 'payment' && teamId) {
          const packSlug = meta.pack_slug as string | undefined;
          const pack = getTokenPackById(packSlug);
          const paymentId = (s.payment_intent as string | null) ?? undefined;
          const alreadyGranted = paymentId
            ? (
                await db
                  .select({ id: tokenTransactions.id })
                  .from(tokenTransactions)
                  .where(eq(tokenTransactions.stripePaymentId, paymentId))
                  .limit(1)
              ).length > 0
            : false;
          if (pack && !alreadyGranted) {
            await recordTokenPurchase({
              teamId,
              pack,
              amountEur: pack.priceEur,
              stripePaymentId: paymentId,
              type: 'purchase',
            });
          }
        }

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription & {
          current_period_end?: number;
          cancel_at?: number;
        };

        await db
          .update(teamSubscriptions)
          .set({
            status: mapStripeSubStatus(sub.status),
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(teamSubscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription & {
          current_period_end?: number;
          cancel_at?: number;
        };

        await Promise.all([
          db
            .update(teamSubscriptions)
            .set({
              status: 'canceled',
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
              updatedAt: new Date(),
            })
            .where(eq(teamSubscriptions.stripeSubscriptionId, sub.id)),

          // Revert the team back to free — Stripe has confirmed the sub is gone
          db
            .update(teams)
            .set({
              planName: 'free',
              subscriptionStatus: 'canceled',
              stripeSubscriptionId: null,
              updatedAt: new Date(),
            })
            .where(eq(teams.stripeSubscriptionId, sub.id)),
        ]);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Cast broadly to avoid Stripe SDK version mismatches on optional fields
        const inv = event.data.object as any;

        const customerEmail: string | undefined = inv.customer_email;
        if (!customerEmail) break;

        const piId: string | null = inv.payment_intent ?? null;
        const pi = piId
          ? await stripe.paymentIntents.retrieve(piId, { expand: ['payment_method'] }).catch(() => null)
          : null;
        const card = (pi?.payment_method as Stripe.PaymentMethod | null)?.card;

        const subId2: string | null = inv.subscription ?? null;
        const sub2 = subId2
          ? await stripe.subscriptions.retrieve(subId2).catch(() => null) as any
          : null;

        const lineItem = inv.lines?.data?.[0];
        const planName: string = lineItem?.description ?? 'Pro';

        sendPaymentReceiptEmail({
          to: customerEmail,
          firstName: ((inv.customer_name ?? customerEmail) as string).split(' ')[0],
          billingName: inv.customer_name ?? customerEmail,
          planName,
          billingAmountCents: inv.amount_paid ?? 0,
          billingCurrency: inv.currency ?? 'eur',
          billingDate: new Date(inv.created * 1000),
          periodStart: new Date((inv.period_start ?? inv.created) * 1000),
          periodEnd: new Date((inv.period_end ?? inv.created) * 1000),
          invoiceNumber: inv.number ?? '',
          invoicePdfUrl: inv.invoice_pdf ?? '',
          cardBrand: card?.brand ?? 'Card',
          cardLast4: card?.last4 ?? '****',
          nextRenewalDate: sub2?.current_period_end
            ? new Date(sub2.current_period_end * 1000)
            : new Date(),
        }).catch((e) => console.error('[webhook] payment receipt email failed', e));

        break;
      }

      // Add more handlers (invoice.payment_failed, etc.) as needed
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
