// scripts/seed-plans.ts
//
// Seeds `plans` and `plan_prices` from the live Stripe catalogue.
// Idempotent: safe to re-run after a price change. Run it against each
// environment's database (scratch Neon branch first).
//
//   pnpm tsx scripts/seed-plans.ts
//
// Why a script and not a migration: the migration journal is mid-rebaseline
// on branch claude/mvp-launch-p0, and prices change far more often than
// schema does. Re-running this is cheaper than a migration per price edit.

import 'dotenv/config';
import { and, eq, notInArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { plans, planPrices } from '@/lib/db/schema/billing/plans';

type Billing = 'monthly' | 'yearly';

type Currency = 'usd' | 'eur' | 'gbp' | 'chf' | 'cad' | 'aud' | 'sgd' | 'nzd' | 'sek';

interface PriceSeed {
  currency: Currency;
  billing: Billing;
  amountCents: number;
  stripePriceId: string;
}

interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  stripeProductId: string | null;
  prices: PriceSeed[];
}

// ---------------------------------------------------------------------------
// The catalogue. This is the single source of truth for price IDs.
// Stripe account acct_1RcPVICs6GUQsp1I (live).
//
// Each Stripe price has Multiple Currencies enabled (currency_options), so one
// price ID serves every currency below. We record a row per currency so the app
// can look up a presentment amount without calling Stripe; all rows for a price
// carry the same ID. Amounts must match Stripe — see
// scripts/add-currency-options.mjs, which writes them there.
// ---------------------------------------------------------------------------

// Minor units, by currency.
type Amounts = Record<Currency, number>;

function expand(billing: Billing, stripePriceId: string, amounts: Amounts): PriceSeed[] {
  return (Object.entries(amounts) as [Currency, number][]).map(([currency, amountCents]) => ({
    currency,
    billing,
    amountCents,
    stripePriceId,
  }));
}

const PRO_MONTHLY: Amounts = { usd: 1900, eur: 1900, gbp: 1700, chf: 1900, cad: 2500, aud: 2900, sgd: 2500, nzd: 3100, sek: 19900 };
const PRO_YEARLY: Amounts = { usd: 19000, eur: 19000, gbp: 17000, chf: 19000, cad: 25000, aud: 29000, sgd: 25000, nzd: 31000, sek: 199000 };
const AGENCY_MONTHLY: Amounts = { usd: 4900, eur: 4900, gbp: 4400, chf: 4900, cad: 6500, aud: 7500, sgd: 6500, nzd: 8000, sek: 51900 };
const AGENCY_YEARLY: Amounts = { usd: 49000, eur: 49000, gbp: 44000, chf: 49000, cad: 65000, aud: 75000, sgd: 65000, nzd: 80000, sek: 519000 };

const CATALOGUE: PlanSeed[] = [
  {
    slug: 'free',
    name: 'Free',
    description: "Understand your site's health with no commitment.",
    stripeProductId: null,
    prices: [],
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'For growing sites that need automated repairs.',
    stripeProductId: 'prod_UCFWLyxay24p3A',
    prices: [
      ...expand('monthly', 'price_1TDr1XCs6GUQsp1I4UDcDRpF', PRO_MONTHLY),
      ...expand('yearly', 'price_1TDr1XCs6GUQsp1IESTw31tP', PRO_YEARLY),
    ],
  },
  {
    slug: 'agent',
    // Stripe product is named "GetSafe 360 AI Agency". The slug stays `agent`
    // because LogicalPlanId, STRIPE_PLAN_MAPPING and the existing routes all
    // use it; only the customer-facing name is "Agency".
    name: 'Agency',
    description: 'For agencies and professionals managing multiple client sites.',
    stripeProductId: null, // TODO: paste the Agency product's prod_… id
    prices: [
      ...expand('monthly', 'price_1TDrW3Cs6GUQsp1ImxkxMw4l', AGENCY_MONTHLY),
      ...expand('yearly', 'price_1TDrW3Cs6GUQsp1IjnOw41MN', AGENCY_YEARLY),
    ],
  },
  {
    slug: 'business',
    name: 'Business',
    description: 'For teams and organizations that need scale, control, and SLAs.',
    stripeProductId: null, // contact-sales, no Stripe price
    prices: [],
  },
];

// `region` is nullable AND part of the unique index. In Postgres, NULLs are
// distinct in a unique index, so ON CONFLICT would never match an existing
// NULL-region row and every run would insert duplicates. We therefore look the
// row up explicitly instead of relying on upsert semantics.
const REGION = null;

async function main() {
  const db = getDb();
  let created = 0;
  let updated = 0;

  for (const seed of CATALOGUE) {
    const [existing] = await db
      .select()
      .from(plans)
      .where(eq(plans.slug, seed.slug))
      .limit(1);

    let planId: string;

    if (existing) {
      planId = existing.id;
      await db
        .update(plans)
        .set({
          name: seed.name,
          description: seed.description,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, planId));
      console.log(`plan   ~ ${seed.slug}`);
    } else {
      const [row] = await db
        .insert(plans)
        .values({
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          isActive: true,
        })
        .returning({ id: plans.id });
      planId = row.id;
      console.log(`plan   + ${seed.slug}`);
    }

    for (const price of seed.prices) {
      const [existingPrice] = await db
        .select()
        .from(planPrices)
        .where(
          and(
            eq(planPrices.planId, planId),
            eq(planPrices.currency, price.currency),
            eq(planPrices.billing, price.billing),
          ),
        )
        .limit(1);

      if (existingPrice) {
        await db
          .update(planPrices)
          .set({
            amountCents: price.amountCents,
            stripePriceId: price.stripePriceId,
            stripeProductId: seed.stripeProductId,
          })
          .where(eq(planPrices.id, existingPrice.id));
        updated++;
        console.log(`  price ~ ${seed.slug} ${price.currency} ${price.billing}`);
      } else {
        await db.insert(planPrices).values({
          planId,
          currency: price.currency,
          billing: price.billing,
          amountCents: price.amountCents,
          region: REGION,
          stripeProductId: seed.stripeProductId,
          stripePriceId: price.stripePriceId,
        });
        created++;
        console.log(`  price + ${seed.slug} ${price.currency} ${price.billing}`);
      }
    }
  }

  // Retire plans that are no longer in the catalogue (e.g. a legacy 'starter').
  // Deactivate rather than delete: team_subscriptions.plan_id is ON DELETE RESTRICT.
  const retired = await db
    .update(plans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(notInArray(plans.slug, CATALOGUE.map((p) => p.slug)), eq(plans.isActive, true)))
    .returning({ slug: plans.slug });
  for (const r of retired) console.log(`plan   - ${r.slug} (deactivated)`);

  console.log(`\ndone — ${created} prices created, ${updated} updated`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
