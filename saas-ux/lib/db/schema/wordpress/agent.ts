import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';
import { changeSets } from '../copilot/changes';

export const wordpressSiteSnapshots = pgTable('wordpress_site_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('connector'),
  builder: text('builder').notNull().default('unknown'),
  wordpressVersion: text('wordpress_version'),
  pluginVersion: text('plugin_version'),
  activeTheme: text('active_theme'),
  pluginCount: integer('plugin_count'),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('wp_snapshots_site_idx').on(t.siteId),
  bySiteCreated: index('wp_snapshots_site_created_idx').on(t.siteId, t.createdAt),
}));

export const wordpressActionRuns = pgTable('wordpress_action_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  changeSetId: uuid('change_set_id').references(() => changeSets.id, { onDelete: 'set null' }),
  actionId: text('action_id').notNull(),
  actionType: text('action_type').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  risk: text('risk'),
  autoApplied: boolean('auto_applied').notNull().default(false),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  inputPayload: jsonb('input_payload').notNull(),
  resultPayload: jsonb('result_payload'),
  rollbackPayload: jsonb('rollback_payload'),
  verificationOk: boolean('verification_ok'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('wp_action_runs_site_idx').on(t.siteId),
  byActionId: index('wp_action_runs_action_id_idx').on(t.actionId),
  byChangeSet: index('wp_action_runs_changeset_idx').on(t.changeSetId),
}));

export const wordpressVerifications = pgTable('wordpress_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionRunId: uuid('action_run_id').notNull().references(() => wordpressActionRuns.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  ok: boolean('ok').notNull().default(false),
  checks: jsonb('checks').notNull(),
  domSummary: text('dom_summary'),
  screenshotUrl: text('screenshot_url'),
  resultPayload: jsonb('result_payload'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byActionRun: index('wp_verifications_action_run_idx').on(t.actionRunId),
  bySite: index('wp_verifications_site_idx').on(t.siteId),
}));

export type WordPressSiteSnapshotRow = typeof wordpressSiteSnapshots.$inferSelect;
export type NewWordPressSiteSnapshotRow = typeof wordpressSiteSnapshots.$inferInsert;
export type WordPressActionRunRow = typeof wordpressActionRuns.$inferSelect;
export type NewWordPressActionRunRow = typeof wordpressActionRuns.$inferInsert;
export type WordPressVerificationRow = typeof wordpressVerifications.$inferSelect;
export type NewWordPressVerificationRow = typeof wordpressVerifications.$inferInsert;
