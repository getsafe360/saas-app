// lib/db/schema/jobs/scans.ts
// Scan and fix job tables

import {
  pgTable, uuid, integer, varchar, text, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jobStatusEnum, agentEnum } from '../_shared/enums';
import { sites } from '../sites/sites';
import { teams } from '../auth/teams';
import { changeSets } from '../copilot/changes';

export const scanJobs = pgTable('scan_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),

  status: jobStatusEnum('status').notNull().default('queued'),
  categories: text('categories').notNull(),
  agentUsed: agentEnum('agent_used'),
  costTokens: integer('cost_tokens').notNull().default(0),

  reportBlobKey: text('report_blob_key'),
  errorMessage: text('error_message'),

  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
}, (t) => ({
  bySite: index('scan_jobs_site_idx').on(t.siteId),
  byStatus: index('scan_jobs_status_idx').on(t.status),
}));

export const fixJobs = pgTable('fix_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),

  status: jobStatusEnum('status').notNull().default('queued'),
  kind: varchar('kind', { length: 32 }),

  issues: jsonb('issues').$type<{ id: string; estTokens: number }[]>().notNull(),
  estTokens: integer('est_tokens').notNull().default(0),
  agentUsed: agentEnum('agent_used'),

  resultBlobKey: varchar('result_blob_key', { length: 256 }),
  errorMessage: text('error_message'),

  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('fix_jobs_site_idx').on(t.siteId),
  byTeam: index('fix_jobs_team_idx').on(t.teamId),
  byStatus: index('fix_jobs_status_idx').on(t.status),
}));

export const editJobs = pgTable('edit_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  changeSetId: uuid('change_set_id').notNull().references(() => changeSets.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').notNull().default('queued'),
  agentUsed: agentEnum('agent_used'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  byChangeSet: index('edit_jobs_cs_idx').on(t.changeSetId),
}));

// Type exports
export type ScanJob = typeof scanJobs.$inferSelect;
export type NewScanJob = typeof scanJobs.$inferInsert;
export type FixJob = typeof fixJobs.$inferSelect;
export type NewFixJob = typeof fixJobs.$inferInsert;
export type EditJob = typeof editJobs.$inferSelect;
