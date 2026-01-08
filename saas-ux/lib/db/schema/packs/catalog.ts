// lib/db/schema/packs/catalog.ts
// App packs catalog and site pack assignments

import {
  pgTable, uuid, varchar, text, integer, timestamp, boolean as pgBool, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';

export const appPacks = pgTable('app_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
  isEnabled: pgBool('is_enabled').notNull().default(true),

  priceCents: integer('price_cents').notNull().default(0),
  priceCurrency: varchar('price_currency', { length: 3 }).notNull().default('EUR'),
  billing: varchar('billing', { length: 16 }).notNull().default('monthly'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const appPackTranslations = pgTable('app_pack_translations', {
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
}, (t) => ({
  uniq: uniqueIndex('apt_pack_locale_uq').on(t.packId, t.locale),
  byPack: index('apt_pack_idx').on(t.packId),
}));

export const appPackPrices = pgTable('app_pack_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull(),
  billing: varchar('billing', { length: 16 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  region: varchar('region', { length: 2 }),
  stripeProductId: varchar('stripe_product_id', { length: 128 }),
  stripePriceId: varchar('stripe_price_id', { length: 128 }),
}, (t) => ({
  uniq: uniqueIndex('app_pack_prices_pack_cur_bill_reg_uq').on(t.packId, t.currency, t.billing, t.region),
  byPack: index('app_pack_prices_pack_idx').on(t.packId),
}));

export const sitePacks = pgTable('site_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).notNull().default('installed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('site_packs_site_pack_uq').on(t.siteId, t.packId),
  bySite: index('site_packs_site_idx').on(t.siteId),
}));

// Type exports
export type AppPack = typeof appPacks.$inferSelect;
export type AppPackPrice = typeof appPackPrices.$inferSelect;
