// lib/db/schema/scans/scheduled.ts
// Scheduled scans and scan summaries

import {
  pgTable, uuid, varchar, text, timestamp, jsonb, boolean as pgBool, index
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';
import { scanJobs } from '../jobs/scans';

export const scheduledScans = pgTable('scheduled_scans', {
  siteId: uuid('site_id').primaryKey().references(() => sites.id, { onDelete: 'cascade' }),
  frequency: varchar('frequency', { length: 16 }).notNull().default('monthly'),
  nextRunAt: timestamp('next_run_at').notNull(),
  isEnabled: pgBool('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  runnableIdx: index('scheduled_scans_runnable_idx').on(t.isEnabled, t.nextRunAt),
}));

export const scanSummaries = pgTable('scan_summaries', {
  jobId: uuid('job_id').primaryKey().references(() => scanJobs.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  cms: varchar('cms', { length: 32 }),
  screenshotUrl: text('screenshot_url'),
  faviconUrl: text('favicon_url'),
  scores: jsonb('scores'),
  findings: jsonb('findings'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('scan_summaries_site_idx').on(t.siteId),
  bySiteCreated: index('scan_summaries_site_created_idx').on(t.siteId, t.createdAt),
}));

// Type exports
export type ScheduledScan = typeof scheduledScans.$inferSelect;
export type ScanSummary = typeof scanSummaries.$inferSelect;
