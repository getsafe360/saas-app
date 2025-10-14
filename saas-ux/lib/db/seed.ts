// lib/db/seed.ts
import 'server-only';
import { getDb } from './drizzle';
import {
  paymentMethods,
  paymentMethodTranslations,
  regionPaymentMethods,
  taxDisplayPolicies,
} from './schema';

export async function seed() {
  const db = getDb();

  // --- Payment methods (code is the PK) ---
  await db
    .insert(paymentMethods)
    .values([
      { code: 'card',        category: 'card',  provider: 'stripe', isEnabled: true, iconHint: 'credit-card' },
      { code: 'paypal',      category: 'wallet', provider: 'stripe', isEnabled: true, iconHint: 'paypal' },
      { code: 'sepa_debit',  category: 'bank',  provider: 'stripe', isEnabled: true, iconHint: 'bank' },
    ])
    .onConflictDoNothing();

  // --- Localized names (methodCode + locale unique) ---
  await db
    .insert(paymentMethodTranslations)
    .values([
      { methodCode: 'card',       locale: 'de', name: 'Kreditkarte' },
      { methodCode: 'paypal',     locale: 'de', name: 'PayPal' },
      { methodCode: 'sepa_debit', locale: 'de', name: 'SEPA-Lastschrift' },
    ])
    .onConflictDoNothing();

  // --- Region mapping (region + methodCode unique) ---
  await mapRegion('DE', [
    { code: 'card',       enabled: true,  priority: 10 },
    { code: 'sepa_debit', enabled: true,  priority: 20 },
    { code: 'paypal',     enabled: false, priority: 30 },
  ]);

  await mapRegion('US', [
    { code: 'card',       enabled: true,  priority: 10 },
    { code: 'paypal',     enabled: true,  priority: 20 },
    { code: 'sepa_debit', enabled: false, priority: 30 },
  ]);

  // --- Tax display per country (PK = country) ---
  await upsertTax('DE', 'gross'); // -> tax_included
  await upsertTax('US', 'net');   // -> tax_added

  // Helpers
  async function mapRegion(
    regionCode: string,
    items: { code: string; enabled: boolean; priority?: number }[]
  ) {
    for (const it of items) {
      await db
        .insert(regionPaymentMethods)
        .values({
          region: regionCode,            // ISO-2
          methodCode: it.code,           // FK to payment_methods.code
          enabled: it.enabled,
          priority: it.priority ?? 100,
        })
        .onConflictDoUpdate({
          target: [regionPaymentMethods.region, regionPaymentMethods.methodCode],
          set: { enabled: it.enabled, priority: it.priority ?? 100 },
        });
    }
  }

  type DisplayMode = 'gross' | 'net';
  async function upsertTax(countryCode: string, mode: DisplayMode) {
    const taxLabel = mode === 'gross' ? 'tax_included' : 'tax_added';
    await db
      .insert(taxDisplayPolicies)
      .values({ country: countryCode, taxLabel })
      .onConflictDoUpdate({
        target: taxDisplayPolicies.country,
        set: { taxLabel },
      });
  }
}
