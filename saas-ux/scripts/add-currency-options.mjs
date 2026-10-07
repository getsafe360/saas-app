// scripts/add-currency-options.mjs
//
// Adds regional currencies (GBP, CHF, CAD, AUD, SGD, NZD, SEK) to the EXISTING
// Stripe prices via currency_options. No new products or price IDs; payment
// links and stored IDs keep working.
//
//   Dry run (default, writes nothing):
//     STRIPE_SECRET_KEY=sk_live_... node scripts/add-currency-options.mjs
//   Apply:
//     STRIPE_SECRET_KEY=sk_live_... node scripts/add-currency-options.mjs --apply
//
// Safe to re-run: currencies already present on a price are left untouched.
// prices.update REPLACES currency_options wholesale, so existing entries
// (e.g. eur/usd) are merged back in rather than dropped.
//
// Amounts are minor units. None of these currencies are zero-decimal.

import Stripe from 'stripe';

const apply = process.argv.includes('--apply');
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set → export it in this shell and re-run');
  process.exit(1);
}
const stripe = new Stripe(key);
console.log(`Mode: ${key.startsWith('sk_live') || key.startsWith('rk_live') ? 'LIVE' : 'TEST'} · ${apply ? 'APPLY' : 'DRY RUN'}\n`);

// Major-unit amounts per currency, per price. Order: gbp chf cad aud sgd nzd sek
const CURRENCIES = ['gbp', 'chf', 'cad', 'aud', 'sgd', 'nzd', 'sek'];

const PRICES = [
  { id: 'price_1TDr1XCs6GUQsp1I4UDcDRpF', label: 'Pro monthly',    amounts: [17, 19, 25, 29, 25, 31, 199] },
  { id: 'price_1TDr1XCs6GUQsp1IESTw31tP', label: 'Pro yearly',     amounts: [170, 190, 250, 290, 250, 310, 1990] },
  { id: 'price_1TDrW3Cs6GUQsp1ImxkxMw4l', label: 'Agency monthly', amounts: [44, 49, 65, 75, 65, 80, 519] },
  { id: 'price_1TDrW3Cs6GUQsp1IjnOw41MN', label: 'Agency yearly',  amounts: [440, 490, 650, 750, 650, 800, 5190] },
  { id: 'price_1TDrf7Cs6GUQsp1ImJb2UqnL', label: 'Pack small',     amounts: [4.5, 5, 6.5, 7.5, 6.5, 8, 55] },
  { id: 'price_1TDrgbCs6GUQsp1IcfGivg68', label: 'Pack medium',    amounts: [9, 10, 13, 15, 13, 16, 105] },
  { id: 'price_1TDri1Cs6GUQsp1IMIrD9l8C', label: 'Pack large',     amounts: [13.5, 15, 20, 23, 20, 24, 159] },
];

const minor = (major) => Math.round(major * 100);
const fmt = (cents) => (cents / 100).toFixed(2);

let failed = 0;
for (const spec of PRICES) {
  try {
    const price = await stripe.prices.retrieve(spec.id, { expand: ['currency_options'] });
    const existing = price.currency_options ?? {};
    const base = price.currency;
    console.log(`${spec.label} (${spec.id}) · base ${base.toUpperCase()} ${fmt(price.unit_amount)} · has: ${[base, ...Object.keys(existing)].join(', ')}`);

    // Stripe returns several amount fields per option but accepts only one on
    // write, and the base currency is the price itself. Rebuild minimal entries.
    const merged = {};
    for (const [cur, opt] of Object.entries(existing)) {
      if (cur === base) continue;
      merged[cur] = { unit_amount: opt.unit_amount };
      if (opt.tax_behavior) merged[cur].tax_behavior = opt.tax_behavior;
    }
    const added = [];
    CURRENCIES.forEach((cur, i) => {
      if (cur === base || existing[cur]) return;
      merged[cur] = { unit_amount: minor(spec.amounts[i]) };
      added.push(`${cur.toUpperCase()} ${fmt(merged[cur].unit_amount)}`);
    });

    if (!added.length) {
      console.log('  nothing to add\n');
      continue;
    }
    console.log(`  + ${added.join(' | ')}`);

    if (apply) {
      await stripe.prices.update(spec.id, { currency_options: merged });
      console.log('  ✔ updated');
    }
    console.log();
  } catch (err) {
    failed++;
    console.error(`  ✖ ${spec.label}: ${err.message}\n`);
  }
}

if (!apply) console.log('Dry run only. Re-run with --apply to write.');
process.exit(failed ? 1 : 0);
