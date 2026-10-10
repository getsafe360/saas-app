// app/api/stripe/create-checkout-session/route.ts
//
// Starts a Stripe Checkout Session for the signed-in user's team. This is what
// makes fulfilment work: the session carries metadata.team_id / plan_slug /
// pack_slug, which the webhook needs. Payment Links cannot set that metadata.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDbUserFromClerk, findCurrentUserTeam } from '@/lib/auth/current';
import { createCheckoutSession } from '@/lib/server/payments/checkout';
import { parseCheckoutTarget, priceIdForTarget } from '@/config/billing/catalogue';
import { stripe } from '@/lib/payments/stripe';
import { currencyForCountry, isCurrency } from '@/config/billing/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getDbUserFromClerk();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required → Sign in and try again' }, { status: 401 });
  }

  const target = parseCheckoutTarget(await req.json().catch(() => null));
  if (!target) {
    return NextResponse.json({ error: 'Invalid checkout request → Pick a plan or pack' }, { status: 400 });
  }

  const team = await findCurrentUserTeam();
  if (!team) {
    return NextResponse.json({ error: 'No team found → Contact support' }, { status: 409 });
  }

  // A team that already has a live subscription should manage it in the portal,
  // not buy a second one.
  if (
    target.kind === 'plan' &&
    team.stripeSubscriptionId &&
    ['active', 'trialing', 'past_due'].includes(team.subscriptionStatus)
  ) {
    return NextResponse.json(
      { error: 'You already have a subscription → Manage it in billing settings' },
      { status: 409 },
    );
  }

  const origin = req.nextUrl.origin;

  // Currency comes from the real request country, never from the client, so it
  // cannot be used as a discount switch. It matches what /pricing displayed.
  // A Stripe customer is locked to the currency of their first subscription or
  // invoice, so an existing customer is charged in that currency regardless of
  // where they are now.
  const country = req.headers.get('x-vercel-ip-country');
  let currency: string | undefined = currencyForCountry(country);
  if (team.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(team.stripeCustomerId);
      if (!customer.deleted && customer.currency) {
        // Unknown currency (not one of ours) -> let Stripe decide.
        currency = isCurrency(customer.currency) ? customer.currency.toLowerCase() : undefined;
      }
    } catch (err) {
      console.error('[create-checkout-session] customer lookup failed', err);
      currency = undefined; // let Stripe use the customer's currency
    }
  }

  try {
    const session = await createCheckoutSession({
      customerId: team.stripeCustomerId ?? undefined,
      customerEmail: user.email ?? undefined,
      priceId: priceIdForTarget(target),
      mode: target.kind === 'plan' ? 'subscription' : 'payment',
      currency,
      region: country,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing`,
      teamId: team.id,
      planSlug: target.kind === 'plan' ? target.plan : undefined,
      billing: target.kind === 'plan' ? target.billing : undefined,
      packSlug: target.kind === 'pack' ? target.pack : undefined,
      allowPromotionCodes: true,
    });

    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] failed', err);
    return NextResponse.json({ error: 'Checkout failed → Try again in a moment' }, { status: 502 });
  }
}
