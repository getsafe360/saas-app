// config/billing/catalogue.ts
//
// Single source of truth for Stripe price IDs used by checkout.
// Stripe account acct_1RcPVICs6GUQsp1I (live). Every price carries
// currency_options for 9 currencies (see scripts/add-currency-options.mjs), so
// one ID serves all regions; Checkout picks the customer's currency.
//
// Price IDs are resolved server-side from a slug — the client never sends one.

export type CheckoutPlanSlug = 'pro' | 'agent';
export type BillingInterval = 'monthly' | 'yearly';
export type CheckoutPackSlug = 'small' | 'medium' | 'large';

export const PLAN_PRICE_IDS: Record<CheckoutPlanSlug, Record<BillingInterval, string>> = {
  pro: {
    monthly: 'price_1TDr1XCs6GUQsp1I4UDcDRpF',
    yearly: 'price_1TDr1XCs6GUQsp1IESTw31tP',
  },
  agent: {
    monthly: 'price_1TDrW3Cs6GUQsp1ImxkxMw4l',
    yearly: 'price_1TDrW3Cs6GUQsp1IjnOw41MN',
  },
};

export const PACK_PRICE_IDS: Record<CheckoutPackSlug, string> = {
  small: 'price_1TDrf7Cs6GUQsp1ImJb2UqnL',
  medium: 'price_1TDrgbCs6GUQsp1IcfGivg68',
  large: 'price_1TDri1Cs6GUQsp1IMIrD9l8C',
};

export type CheckoutTarget =
  | { kind: 'plan'; plan: CheckoutPlanSlug; billing: BillingInterval }
  | { kind: 'pack'; pack: CheckoutPackSlug };

/** Maps a price ID back to a plan slug (used by webhook fallbacks). */
export function planSlugForPriceId(priceId: string): CheckoutPlanSlug | null {
  for (const [slug, prices] of Object.entries(PLAN_PRICE_IDS)) {
    if (Object.values(prices).includes(priceId)) return slug as CheckoutPlanSlug;
  }
  return null;
}

/**
 * Validates untrusted client input. Accepts the marketing page's `agency` as an
 * alias for the `agent` slug used in the database.
 */
export function parseCheckoutTarget(input: unknown): CheckoutTarget | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;

  if (i.kind === 'plan') {
    const plan = i.plan === 'agency' ? 'agent' : i.plan;
    const billing = i.billing === 'yearly' ? 'yearly' : i.billing === 'monthly' ? 'monthly' : null;
    if ((plan === 'pro' || plan === 'agent') && billing) return { kind: 'plan', plan, billing };
    return null;
  }
  if (i.kind === 'pack') {
    if (i.pack === 'small' || i.pack === 'medium' || i.pack === 'large') {
      return { kind: 'pack', pack: i.pack };
    }
  }
  return null;
}

export function priceIdForTarget(target: CheckoutTarget): string {
  return target.kind === 'plan' ? PLAN_PRICE_IDS[target.plan][target.billing] : PACK_PRICE_IDS[target.pack];
}
