// lib/db/queries/billing.ts
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../drizzle';
import {
  paymentMethods,
  paymentMethodTranslations,
  regionPaymentMethods,
  taxDisplayPolicies,
} from '../schema';

/** What the UI usually needs per method. */
export type RegionMethod = {
  code: string;
  label: string;              // localized name or fallback to code
  enabled: boolean;           // regionEnabled && globallyEnabled
  provider: string | null;
  category: string | null;
  iconHint: string | null;
  priority: number;
};

/**
 * Region → enabled payment methods (optionally include disabled).
 * - Filters both the region-specific flag and the global `isEnabled` unless `includeDisabled` is true.
 * - Localizes with `payment_method_translations.name` for the given `locale` (fallback: code).
 */
export async function listPaymentMethodsForRegion(params: {
  regionCode: string;         // ISO-2 (matches regionPaymentMethods.region)
  locale?: string;            // e.g. 'en', 'de'
  includeDisabled?: boolean;  // default false
}): Promise<RegionMethod[]> {
  const { regionCode, locale = 'en', includeDisabled = false } = params;
  const db = getDb();

  const whereParts = [eq(regionPaymentMethods.region, regionCode)];
  if (!includeDisabled) {
    whereParts.push(eq(regionPaymentMethods.enabled, true));
    whereParts.push(eq(paymentMethods.isEnabled, true));
  }

  const rows = await db
    .select({
      code: paymentMethods.code,
      provider: paymentMethods.provider,
      category: paymentMethods.category,
      iconHint: paymentMethods.iconHint,
      globallyEnabled: paymentMethods.isEnabled,
      regionEnabled: regionPaymentMethods.enabled,
      priority: regionPaymentMethods.priority,
      name: paymentMethodTranslations.name, // may be null if missing translation
    })
    .from(regionPaymentMethods)
    .innerJoin(
      paymentMethods,
      eq(paymentMethods.code, regionPaymentMethods.methodCode)
    )
    .leftJoin(
      paymentMethodTranslations,
      and(
        eq(paymentMethodTranslations.methodCode, paymentMethods.code),
        eq(paymentMethodTranslations.locale, locale)
      )
    )
    .where(and(...whereParts))
    .orderBy(regionPaymentMethods.priority, paymentMethods.code);

  return rows.map((r) => ({
    code: r.code,
    label: r.name ?? r.code,
    enabled: Boolean(r.regionEnabled && r.globallyEnabled),
    provider: r.provider ?? null,
    category: r.category ?? null,
    iconHint: r.iconHint ?? null,
    priority: r.priority,
  }));
}

/** Full tax policy object for a given country (ISO-2). Provides sensible defaults if missing. */
export async function getTaxPolicyForCountry(countryCode: string) {
  const db = getDb();
  const [row] = await db
    .select({
      country: taxDisplayPolicies.country,
      taxLabel: taxDisplayPolicies.taxLabel,               // 'tax_included' | 'tax_added' | 'tax_may_apply' (string union ok)
      collectVatId: taxDisplayPolicies.collectVatId,
      collectNationalId: taxDisplayPolicies.collectNationalId,
      reverseChargeEligible: taxDisplayPolicies.reverseChargeEligible,
      note: taxDisplayPolicies.note,
    })
    .from(taxDisplayPolicies)
    .where(eq(taxDisplayPolicies.country, countryCode))
    .limit(1);

  return (
    row ?? {
      country: countryCode,
      taxLabel: 'tax_included',
      collectVatId: false,
      collectNationalId: false,
      reverseChargeEligible: false,
      note: null as string | null,
    }
  );
}

/** Back-compat alias if you previously consumed only the “display mode”. */
export async function getTaxDisplayForRegion(regionCode: string) {
  const policy = await getTaxPolicyForCountry(regionCode);
  return policy.taxLabel;
}
// Note: You can add more billing-related queries here as needed.