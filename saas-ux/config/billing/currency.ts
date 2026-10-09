// config/billing/currency.ts
//
// Local-currency pricing. Amounts mirror the currency_options set on the Stripe
// prices (see scripts/add-currency-options.mjs, which holds the same numbers —
// change both together). Amounts are in MAJOR units (19 = €19.00).
//
// The currency is chosen from the visitor's COUNTRY on the server
// (x-vercel-ip-country). It is never a client-selectable control, so it cannot be
// used as a discount switch, and Checkout is told the same currency the page showed.

import type { BillingInterval, CheckoutPackSlug, CheckoutPlanSlug } from './catalogue';

export const CURRENCIES = ['eur', 'usd', 'gbp', 'chf', 'cad', 'aud', 'sgd', 'nzd', 'sek'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'eur';

const COUNTRY_CURRENCY: Record<string, Currency> = {
  US: 'usd',
  GB: 'gbp',
  CH: 'chf',
  LI: 'chf',
  CA: 'cad',
  AU: 'aud',
  SG: 'sgd',
  NZ: 'nzd',
  SE: 'sek',
};

/** Unmapped countries (including the eurozone) get EUR. */
export function currencyForCountry(country: string | null | undefined): Currency {
  return COUNTRY_CURRENCY[(country ?? '').toUpperCase()] ?? DEFAULT_CURRENCY;
}

type Amounts = Record<Currency, number>;

const PRO_MONTHLY: Amounts = { eur: 19, usd: 19, gbp: 17, chf: 19, cad: 25, aud: 29, sgd: 25, nzd: 31, sek: 199 };
const AGENT_MONTHLY: Amounts = { eur: 49, usd: 49, gbp: 44, chf: 49, cad: 65, aud: 75, sgd: 65, nzd: 80, sek: 519 };

// Yearly is 10x monthly (two months free) in every currency.
const yearly = (monthly: Amounts): Amounts =>
  Object.fromEntries(CURRENCIES.map((c) => [c, monthly[c] * 10])) as Amounts;

export const PLAN_AMOUNTS: Record<CheckoutPlanSlug, Record<BillingInterval, Amounts>> = {
  pro: { monthly: PRO_MONTHLY, yearly: yearly(PRO_MONTHLY) },
  agent: { monthly: AGENT_MONTHLY, yearly: yearly(AGENT_MONTHLY) },
};

export const PACK_AMOUNTS: Record<CheckoutPackSlug, Amounts> = {
  small: { eur: 5, usd: 5, gbp: 4.5, chf: 5, cad: 6.5, aud: 7.5, sgd: 6.5, nzd: 8, sek: 55 },
  medium: { eur: 10, usd: 10, gbp: 9, chf: 10, cad: 13, aud: 15, sgd: 13, nzd: 16, sek: 105 },
  large: { eur: 15, usd: 15, gbp: 13.5, chf: 15, cad: 20, aud: 23, sgd: 20, nzd: 24, sek: 159 },
};

/** "€19", "S$25", "CHF 19", "£4.50". Fixed 'en' locale so symbols are consistent. */
export function formatPrice(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
