// lib/db/schema/payments/regions.ts
// Regional payment settings and tax policies

import {
  pgTable, varchar, integer, text, timestamp, boolean as pgBool, uniqueIndex
} from 'drizzle-orm/pg-core';
import { paymentMethods } from './methods';

export const regionPaymentMethods = pgTable('region_payment_methods', {
  region: varchar('region', { length: 2 }).notNull(),
  methodCode: varchar('method_code', { length: 32 }).notNull()
    .references(() => paymentMethods.code, { onDelete: 'cascade' }),
  enabled: pgBool('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(100),
}, (t) => ({
  uniq: uniqueIndex('rpm_region_method_uq').on(t.region, t.methodCode),
}));

export const taxDisplayPolicies = pgTable('tax_display_policies', {
  country: varchar('country', { length: 2 }).primaryKey(),
  taxLabel: varchar('tax_label', { length: 32 }).notNull().default('tax_included'),
  collectVatId: pgBool('collect_vat_id').notNull().default(false),
  collectNationalId: pgBool('collect_national_id').notNull().default(false),
  reverseChargeEligible: pgBool('reverse_charge_eligible').notNull().default(false),
  note: text('note'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Type exports
export type RegionPaymentMethod = typeof regionPaymentMethods.$inferSelect;
export type TaxDisplayPolicy = typeof taxDisplayPolicies.$inferSelect;
