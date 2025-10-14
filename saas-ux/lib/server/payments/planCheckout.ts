// lib/server/payments/planCheckout.ts
import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/conn';              // your DB connector
import { plans, planPrices } from '@/lib/db/schema';
import { createCheckoutSession } from './checkout';
import { syncStripeForPlans } from './stripeSync';

type Billing = 'monthly' | 'yearly';

export async function createPlanCheckoutFromSlug(opts: {
  planSlug: string;                 // e.g. 'starter' | 'pro' | 'business'
  billing: Billing;                 // 'monthly' | 'yearly'
  currency: string;                 // desired currency, e.g. 'EUR'|'USD'|'BRL'
  region?: string | null;           // ISO-2, e.g. 'DE'|'US'|'BR'|'AU'|'NZ'
  teamId: number | string;          // for webhook reconciliation
  successUrl: string;
  cancelUrl: string;

  // Optional customer context
  customerId?: string;              // Stripe customer if known
  customerEmail?: string;           // used when no customerId provided
  locale?: Stripe.Checkout.SessionCreateParams.Locale | 'auto';
  allowPromotionCodes?: boolean;
}) {
  const db = getDb();
  const regionUp = opts.region?.toUpperCase() ?? null;
  const wantedCurrency = opts.currency.toUpperCase();

  // 1) Fetch plan
  const [pl] = await db.select().from(plans).where(eq(plans.slug, opts.planSlug)).limit(1);
  if (!pl) throw new Error(`Plan not found: ${opts.planSlug}`);

  // 2) Helper to pick the best price row for a currency (pref. exact region → null region)
  const pickRow = async (cur: string) => {
    const rows = await db
      .select()
      .from(planPrices)
      .where(
        and(
          eq(planPrices.planId, pl.id),
          eq(planPrices.billing, opts.billing),
          eq(planPrices.currency, cur)
        )
      )
      .limit(50);

    return rows.find(r => (r.region ?? null) === regionUp) ?? rows.find(r => r.region == null);
  };

  // Try desired currency first, then fall back to EUR
  let row = await pickRow(wantedCurrency);
  if (!row) row = await pickRow('EUR');
  if (!row) throw new Error(`No price configured for plan=${opts.planSlug}, billing=${opts.billing}`);

  // 3) Ensure Stripe price exists (idempotent sync if needed)
  if (!row.stripePriceId) {
    await syncStripeForPlans(); // creates missing products/prices & writes back IDs
    const [refetched] = await db.select().from(planPrices).where(eq(planPrices.id, row.id)).limit(1);
    if (!refetched?.stripePriceId) {
      throw new Error('Stripe price missing after sync (plan)');
    }
    row = refetched;
  }

  // 4) Create Checkout Session (Stripe Tax on, metadata for webhook)
  const session = await createCheckoutSession({
    customerId: opts.customerId,
    customerEmail: opts.customerEmail,
    priceId: row.stripePriceId!,
    quantity: 1,
    mode: 'subscription',
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    locale: opts.locale ?? 'auto',
    region: regionUp,
    currency: row.currency,        // actual charged currency
    teamId: opts.teamId,
    planSlug: opts.planSlug,
    allowPromotionCodes: !!opts.allowPromotionCodes,
  });

  return {
    sessionId: session.id,
    url: session.url!,
    planSlug: opts.planSlug,
    billing: opts.billing,
    priceCurrency: row.currency,
    amountCents: row.amountCents,
  };
}
