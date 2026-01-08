// lib/db/schema/payments/methods.ts
// Payment methods and translations

import {
  pgTable, varchar, timestamp, boolean as pgBool, uniqueIndex
} from 'drizzle-orm/pg-core';

export const paymentMethods = pgTable('payment_methods', {
  code: varchar('code', { length: 32 }).primaryKey(),
  provider: varchar('provider', { length: 32 }).notNull().default('stripe'),
  category: varchar('category', { length: 32 }).notNull().default('bank'),
  isEnabled: pgBool('is_enabled').notNull().default(true),
  iconHint: varchar('icon_hint', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const paymentMethodTranslations = pgTable('payment_method_translations', {
  methodCode: varchar('method_code', { length: 32 }).notNull()
    .references(() => paymentMethods.code, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
}, (t) => ({
  uniq: uniqueIndex('pmt_method_locale_uq').on(t.methodCode, t.locale),
}));

// Type exports
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type PaymentMethodTranslation = typeof paymentMethodTranslations.$inferSelect;
