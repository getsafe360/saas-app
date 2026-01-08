// lib/db/schema/guests/sessions.ts
// Guest session and scan management

import {
  pgTable, uuid, varchar, text, timestamp, integer, boolean as pgBool, index, uniqueIndex
} from 'drizzle-orm/pg-core';

export const guestSessions = pgTable('guest_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimToken: varchar('claim_token', { length: 64 }).notNull(),
  ip: varchar('ip', { length: 45 }),
  ua: text('ua'),
  ref: text('ref'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  isClaimed: pgBool('is_claimed').notNull().default(false),
  claimedAt: timestamp('claimed_at'),
  claimedByUserId: integer('claimed_by_user_id'),
}, (t) => ({
  claimTokenUq: uniqueIndex('guest_sessions_claim_token_uq').on(t.claimToken),
  expiresIdx: index('guest_sessions_expires_idx').on(t.expiresAt),
  claimableIdx: index('guest_sessions_claimable_idx').on(t.isClaimed, t.expiresAt),
}));

export const guestScans = pgTable('guest_scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  guestSessionId: uuid('guest_session_id').notNull().references(() => guestSessions.id, { onDelete: 'cascade' }),
  siteUrl: text('site_url').notNull(),
  canonicalHost: text('canonical_host').notNull().default(''),
  canonicalRoot: text('canonical_root').notNull().default(''),
  categories: text('categories').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('done'),
  reportBlobKey: text('report_blob_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySession: index('guest_scans_session_idx').on(t.guestSessionId),
  byHost: index('guest_scans_host_idx').on(t.canonicalHost),
}));

// Type exports
export type GuestSession = typeof guestSessions.$inferSelect;
export type GuestScan = typeof guestScans.$inferSelect;
