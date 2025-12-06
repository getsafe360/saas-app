// lib/db/schema/billing/plans.ts
// Plans, prices, and translations

import { 
  pgTable, uuid, varchar, text, integer, timestamp, 
  boolean as pgBool, index, uniqueIndex 
} from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  isActive: pgBool('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const planPrices = pgTable('plan_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull(),
  billing: varchar('billing', { length: 16 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  region: varchar('region', { length: 2 }),
  stripeProductId: varchar('stripe_product_id', { length: 128 }),
  stripePriceId: varchar('stripe_price_id', { length: 128 }),
}, (t) => ({
  uniq: uniqueIndex('plan_prices_plan_cur_bill_reg_uq').on(t.planId, t.currency, t.billing, t.region),
  byPlan: index('plan_prices_plan_idx').on(t.planId),
}));

export const planTranslations = pgTable('plan_translations', {
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
}, (t) => ({
  uniq: uniqueIndex('plan_translations_plan_locale_uq').on(t.planId, t.locale),
  byPlan: index('plan_translations_plan_idx').on(t.planId),
}));

// Type exports
export type Plan = typeof plans.$inferSelect;
export type PlanPrice = typeof planPrices.$inferSelect;
