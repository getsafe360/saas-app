// lib/server/payments/checkout.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

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
  packSlug?: string;                   // set for pack purchases

  // Tax & payments
  collectTaxId?: boolean;              // override; if omitted we derive from region
  allowPromotionCodes?: boolean;       // let customers apply coupons
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[]; // optional restriction
};

function deriveCollectTaxId(region?: string | null) {
  if (!region) return false;
  const r = region.toUpperCase();

  // EU VAT countries — collect VAT ID to enable reverse charge at Stripe Tax layer
  const EU = new Set([
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
    'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
  ]);
  if (EU.has(r)) return true;

  // Brazil — collect CPF/CNPJ (Stripe Tax uses tax_id_collection for this)
  if (r === 'BR') return true;

  return false; // US/AU/NZ typically add tax at checkout without tax ID
}

/**
 * Create a Stripe Checkout Session with:
 * - automatic tax enabled
 * - correct tax_id_collection (derived from region unless explicitly passed)
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
  if (region) metadata.region = region.toUpperCase();
  if (currency) metadata.currency = currency;

  const collectTaxId = opts.collectTaxId ?? deriveCollectTaxId(region);

  // Shared session params
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: opts.mode,
    customer: opts.customerId,
    customer_email: !opts.customerId ? opts.customerEmail : undefined,
    line_items: [{ price: opts.priceId, quantity: qty }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: !!collectTaxId },
    allow_promotion_codes: !!opts.allowPromotionCodes,
    locale: (opts.locale as any) ?? 'auto',
    client_reference_id: metadata.team_id, // handy in Stripe dashboard

    // Help keep customer records tidy automatically
    customer_update: {
      address: 'auto',
      name: 'auto',
      shipping: 'auto',
    },

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