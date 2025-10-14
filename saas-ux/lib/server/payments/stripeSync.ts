// lib/server/payments/stripeSync.ts
import Stripe from 'stripe';
import { db } from '@/lib/db';
import {
  plans, planPrices,
  appPacks, appPackPrices,
  taxDisplayPolicies,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

/** Decide Stripe tax_behavior from your policy */
async function taxBehaviorForRegion(region: string | null) {
  if (!region) return 'exclusive' as const;
  const [p] = await db.select().from(taxDisplayPolicies)
    .where(eq(taxDisplayPolicies.country, region)).limit(1);
  if (!p) return 'exclusive';
  return p.taxLabel === 'vat_included' ? 'inclusive' : 'exclusive';
}

/** Build a stable, human-friendly lookup_key */
function priceLookupKey(kind: 'plan'|'pack', slug: string, currency: string, billing: string, region: string | null) {
  return `${kind}:${slug}:${currency}:${billing}:${region ?? 'GL'}`.toLowerCase();
}

/** Ensure a Stripe product exists (idempotent via DB) */
async function ensureProduct(opts: { existingId?: string | null, name: string, slug: string, kind: 'plan'|'pack' }) {
  if (opts.existingId) {
    try { return await stripe.products.retrieve(opts.existingId); }
    catch { /* fallthrough to create */ }
  }
  return await stripe.products.create({
    name: opts.name,
    active: true,
    metadata: { kind: opts.kind, slug: opts.slug },
  });
}

/** Create/find a Stripe price for the given product+key */
async function ensurePrice(args: {
  productId: string, amountCents: number, currency: string,
  billing: 'monthly'|'yearly'|'oneoff',
  lookupKey: string, taxBehavior: 'inclusive'|'exclusive'
}) {
  // Try lookup_key fast path
  try {
    const existing = await stripe.prices.list({ lookup_keys: [args.lookupKey], expand: ['data.product'] });
    if (existing.data[0]) return existing.data[0];
  } catch { /* ignore */ }

  // Create new price (Stripe best practice: new price for new amount)
  const base: Stripe.PriceCreateParams = {
    currency: args.currency.toLowerCase(),
    unit_amount: args.amountCents,
    product: args.productId,
    lookup_key: args.lookupKey,
    tax_behavior: args.taxBehavior,
  };
  const params: Stripe.PriceCreateParams =
    args.billing === 'oneoff'
      ? { ...base }
      : { ...base, recurring: { interval: args.billing === 'monthly' ? 'month' : 'year' } };

  return await stripe.prices.create(params);
}

/** Sync all plan prices -> Stripe (product per plan) */
export async function syncStripeForPlans() {
  const plansList = await db.select().from(plans);
  for (const pl of plansList) {
    // Product: prefer any existing price row’s product id, otherwise create new
    const rows = await db.select().from(planPrices).where(eq(planPrices.planId, pl.id));
    if (rows.length === 0) continue;
    const anyProdId = rows.find(r => !!r.stripeProductId)?.stripeProductId ?? null;
    const product = await ensureProduct({ existingId: anyProdId, name: pl.name, slug: pl.slug, kind: 'plan' });

    // Write product id back to rows missing it
    await Promise.all(rows
      .filter(r => r.stripeProductId !== product.id)
      .map(r => db.update(planPrices)
        .set({ stripeProductId: product.id })
        .where(eq(planPrices.id, r.id))
      )
    );

    // Ensure a price per row
    for (const r of rows) {
      const taxBehavior = await taxBehaviorForRegion(r.region ?? null);
      const lookupKey = priceLookupKey('plan', pl.slug, r.currency, r.billing as any, r.region);
      const price = await ensurePrice({
        productId: product.id,
        amountCents: r.amountCents,
        currency: r.currency,
        billing: r.billing as any,
        lookupKey,
        taxBehavior,
      });

      if (r.stripePriceId !== price.id) {
        await db.update(planPrices)
          .set({ stripePriceId: price.id, stripeProductId: product.id })
          .where(eq(planPrices.id, r.id));
      }
    }
  }
}

/** Sync all pack prices -> Stripe (product per pack) */
export async function syncStripeForPacks() {
  const packs = await db.select().from(appPacks).where(eq(appPacks.isEnabled, true));
  for (const pk of packs) {
    const rows = await db.select().from(appPackPrices).where(eq(appPackPrices.packId, pk.id));
    if (rows.length === 0) continue; // if no overrides yet, you can add a base-price row later

    const anyProdId = rows.find(r => !!r.stripeProductId)?.stripeProductId ?? null;
    const product = await ensureProduct({ existingId: anyProdId, name: pk.name, slug: pk.slug, kind: 'pack' });

    await Promise.all(rows
      .filter(r => r.stripeProductId !== product.id)
      .map(r => db.update(appPackPrices)
        .set({ stripeProductId: product.id })
        .where(eq(appPackPrices.id, r.id))
      )
    );

    for (const r of rows) {
      const taxBehavior = await taxBehaviorForRegion(r.region ?? null);
      const lookupKey = priceLookupKey('pack', pk.slug, r.currency, r.billing as any, r.region);
      const price = await ensurePrice({
        productId: product.id,
        amountCents: r.amountCents,
        currency: r.currency,
        billing: r.billing as any, // 'oneoff' supported here
        lookupKey,
        taxBehavior,
      });

      if (r.stripePriceId !== price.id) {
        await db.update(appPackPrices)
          .set({ stripePriceId: price.id, stripeProductId: product.id })
          .where(eq(appPackPrices.id, r.id));
      }
    }
  }
}
