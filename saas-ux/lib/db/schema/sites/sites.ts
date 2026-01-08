// lib/db/schema/sites/sites.ts
// Core sites table

import { pgTable, uuid, integer, text, varchar, timestamp, jsonb, boolean as pgBool, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { siteStatusEnum } from '../_shared/enums';
import { users } from '../auth/users';

// 📊 Connection Logs Table (for debugging and monitoring)
export const connectionLogs = pgTable('connection_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
  success: pgBool('success').notNull(),
});

// Types for TypeScript
export type ConnectionLog = typeof connectionLogs.$inferSelect;
export type NewConnectionLog = typeof connectionLogs.$inferInsert;

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 🔄 Connection Status Fields (NEW - Add these at the top for visibility)
  connectionStatus: varchar('connection_status', { length: 20 }).default('disconnected'),
  lastConnectedAt: timestamp('last_connected_at'),
  connectionError: text('connection_error'),
  retryCount: integer('retry_count').default(0),

  // Optional legacy/plugin id
  externalId: text('external_id'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // As provided by user
  siteUrl: text('site_url').notNull(),

  // Canonicalized values (filled by BEFORE trigger; defaults keep generation happy)
  canonicalHost: text('canonical_host').notNull().default(''),
  canonicalRoot: text('canonical_root').notNull().default(''),
  status: siteStatusEnum('status').notNull().default('pending'),
  cms: varchar('cms', { length: 20 }),
  wpVersion: varchar('wp_version', { length: 20 }),
  pluginVersion: varchar('plugin_version', { length: 20 }),

  // sha256 hex (64 chars) when connected
  tokenHash: varchar('token_hash', { length: 64 }),

  // Convenience flag (also filled by BEFORE trigger)
  isConnected: pgBool('is_connected').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // "Latest scan" snapshot (kept in sync by AFTER trigger on scan_summaries)
  lastScanJobId: uuid('last_scan_job_id'),
  lastScores: jsonb('last_scores'),
  lastCms: varchar('last_cms', { length: 32 }),
  lastScreenshotUrl: text('last_screenshot_url'),
  lastFaviconUrl: text('last_favicon_url'),
  lastFindingCount: integer('last_finding_count'),

  // AI Analysis & Repair
  wordpressConnection: jsonb('wordpress_connection'),
  aiRepairEnabled: pgBool('ai_repair_enabled').default(false),
  lastAiAnalysis: timestamp('last_ai_analysis'),
}, (t) => ({
  uniqUserHost: uniqueIndex('sites_user_host_uq').on(t.userId, t.canonicalHost),
  byUser: index('sites_user_idx').on(t.userId),
  byHost: index('sites_host_idx').on(t.canonicalHost),
  byLastJob: index('sites_last_job_idx').on(t.lastScanJobId),
  // 🆕 Add index for connection status queries (optional but recommended)
  byConnectionStatus: index('sites_connection_status_idx').on(t.connectionStatus),
}));

// Type exports
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;