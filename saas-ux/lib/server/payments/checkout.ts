// lib/server/payments/checkout.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Mode = 'subscription' | 'payment';

export type CheckoutOptions = {
  customerId?: string;                 // existing Stripe customer (if known)
  customerEmail?: string;              // used when no customerId is provided
  priceId: string;                     // canonical Stripe price id (plan or pack)
  quantity?: number;                   // defaults to 1
  mode: Mode;                          // 'subscription' for plans, 'payment' for one-off packs
  successUrl: string;
  cancelUrl: string;

  // UX / locale
  locale?: Stripe.Checkout.SessionCreateParams.Locale | 'auto';

  // Region-aware goodies
  region?: string | null;              // ISO-2, e.g. 'DE','US','BR','AU','NZ'
  currency?: string;                   // 'EUR','USD','BRL' (for metadata traceability)

  // Webhook hints (so /api/stripe/webhook can reconcile)
  teamId?: number | string;
  planSlug?: string;                   // set for plan purchases
  billing?: 'monthly' | 'yearly';      // set for plan purchases
  packSlug?: string;                   // set for pack purchases

  // Tax & payments
  collectTaxId?: boolean;              // defaults to true — B2B, tax ID collected everywhere
  allowPromotionCodes?: boolean;       // let customers apply coupons
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[]; // optional restriction
};

/**
 * Create a Stripe Checkout Session with:
 * - tax_id_collection on by default (B2B: we collect the customer's tax ID for
 *   invoices/reverse charge but do not calculate or charge tax ourselves, so
 *   automatic_tax stays off)
 * - metadata for webhooks (team_id, plan_slug/pack_slug, region, currency)
 * - optional allowed payment method types & promotion codes
 */
export async function createCheckoutSession(opts: CheckoutOptions) {
  const qty = Math.max(1, opts.quantity ?? 1);
  const region = opts.region ?? null;
  const currency = (opts.currency ?? '').toUpperCase() || undefined;

  const metadata: Record<string, string> = {};
  if (opts.teamId != null) metadata.team_id = String(opts.teamId);
  if (opts.planSlug) metadata.plan_slug = opts.planSlug;
  if (opts.packSlug) metadata.pack_slug = opts.packSlug;
  if (opts.billing) metadata.billing = opts.billing;
  if (region) metadata.region = region.toUpperCase();
  if (currency) metadata.currency = currency;

  const collectTaxId = opts.collectTaxId ?? true;

  // Shared session params
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: opts.mode,
    customer: opts.customerId,
    customer_email: !opts.customerId ? opts.customerEmail : undefined,
    // Pin Checkout to a currency. Must be one of the price's currency_options.
    // For an existing customer it must match the customer's locked currency.
    currency: currency?.toLowerCase(),
    line_items: [{ price: opts.priceId, quantity: qty }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    tax_id_collection: { enabled: collectTaxId },
    billing_address_collection: 'required',
    allow_promotion_codes: !!opts.allowPromotionCodes,
    locale: (opts.locale as any) ?? 'auto',
    client_reference_id: metadata.team_id, // handy in Stripe dashboard

    // Stripe only accepts customer_update alongside an existing customer, and
    // requires name/address updates when tax_id_collection is on.
    customer_update: opts.customerId ? { address: 'auto', name: 'auto' } : undefined,

    // Optionally limit methods shown by Checkout (usually not required)
    payment_method_types: opts.paymentMethodTypes,
    // Note: Apple Pay/Google Pay ride under 'card' in Checkout if your domain is verified.
  };

  // Attach metadata where Stripe will preserve it post-checkout
  if (opts.mode === 'subscription') {
    base.metadata = metadata;
    base.subscription_data = {
      metadata,
    };
  } else {
    base.metadata = metadata;
    // Persist a Customer so the collected tax ID and billing details are kept.
    if (!opts.customerId) base.customer_creation = 'always';
    base.payment_intent_data = {
      metadata,
    };
  }

  return await stripe.checkout.sessions.create(base);
}

// Note: You can also create Billing Portal sessions for customer self-service:
// export async function createBillingPortalSession(customerId: string, returnUrl: string) {
//   return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
// }
// https://stripe.com/docs/billing/subscriptions/customer-portal