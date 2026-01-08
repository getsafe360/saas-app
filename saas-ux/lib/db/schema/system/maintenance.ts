// lib/db/schema/system/maintenance.ts
// System maintenance tables (idempotency, blob GC)

import {
  pgTable, varchar, text, timestamp, index
} from 'drizzle-orm/pg-core';

export const idempotency = pgTable('idempotency', {
  key: varchar('key', { length: 128 }).primaryKey(),
  scope: varchar('scope', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const blobGc = pgTable('blob_gc', {
  key: text('key').primaryKey(),
  deleteAfter: timestamp('delete_after').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  whenIdx: index('blob_gc_when_idx').on(t.deleteAfter),
}));
