// lib/db/schema/locales/supported.ts
// Supported locales configuration

import {
  pgTable, varchar, boolean as pgBool, index
} from 'drizzle-orm/pg-core';

export const supportedLocales = pgTable('supported_locales', {
  code: varchar('code', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  enabled: pgBool('enabled').notNull().default(true),
  isDefault: pgBool('is_default').notNull().default(false),
}, (t) => ({
  enabledIdx: index('supported_locales_enabled_idx').on(t.enabled),
}));

// Type exports
export type SupportedLocale = typeof supportedLocales.$inferSelect;
