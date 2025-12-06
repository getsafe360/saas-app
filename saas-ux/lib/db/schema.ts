// lib/db/schema.ts
// LEGACY SCHEMA (Reduced from 690 lines to ~470 lines)
// 
// EXTRACTED TO GROUPS:
// - Enums → _shared/enums.ts
// - Users, Teams → auth/
// - Sites → sites/
// - Plans → billing/
// - Cockpit Layouts → features/
//
// TODO: Gradually migrate remaining tables to groups

import {
  pgTable, uuid, serial, varchar, text, integer, boolean as pgBool,
  timestamp, jsonb, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Import enums from shared (don't redefine here)
import { jobStatusEnum, agentEnum, activityEventEnum, changeSetStatusEnum } from './schema/_shared/enums';
import { users } from './schema/auth/users';
import { teams } from './schema/auth/teams';
import { sites } from './schema/sites/sites';
import { plans } from './schema/billing/plans';

/* =========================
   Jobs (Scan / Fix) + Activity
   ========================= */

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

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  event: activityEventEnum('event').notNull(),
  data: jsonb('data'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('activity_site_idx').on(t.siteId),
  byUser: index('activity_user_idx').on(t.userId),
  byEvent: index('activity_event_idx').on(t.event),
}));

/* =========================
   Guest flow + Idempotency + Blob GC
   ========================= */

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

/* =========================
   Scheduled scans + Scan summaries
   ========================= */

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

/* =========================
   Co-pilot: Snapshots / Changes / Edit jobs
   ========================= */

export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  blobKey: text('blob_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('snapshots_site_idx').on(t.siteId),
}));

export const changeSets = pgTable('change_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }),
  description: text('description'),
  status: changeSetStatusEnum('status').notNull().default('draft'),
  baseSnapshotId: uuid('base_snapshot_id').references(() => snapshots.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('change_sets_site_idx').on(t.siteId),
  byStatus: index('change_sets_status_idx').on(t.status),
}));

export const changeItems = pgTable('change_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  changeSetId: uuid('changeset_id').notNull().references(() => changeSets.id, { onDelete: 'cascade' }),
  op: varchar('op', { length: 16 }).notNull(),
  path: text('path').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byChangeSet: index('change_items_cs_idx').on(t.changeSetId),
}));

export const editJobs = pgTable('edit_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  changesetId: uuid('changeset_id').notNull().references(() => changeSets.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').notNull().default('queued'),
  agentUsed: agentEnum('agent_used'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  byChangeSet: index('edit_jobs_cs_idx').on(t.changesetId),
}));

/* =========================
   App Packs (catalog)
   ========================= */

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

export const packRuns = pgTable('pack_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').notNull().default('queued'),
  resultBlobKey: text('result_blob_key'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
}, (t) => ({
  bySite: index('pack_runs_site_idx').on(t.siteId),
  byPack: index('pack_runs_pack_idx').on(t.packId),
}));

/* =========================
   i18n locales
   ========================= */

export const supportedLocales = pgTable('supported_locales', {
  code: varchar('code', { length: 10 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  enabled: pgBool('enabled').notNull().default(true),
  isDefault: pgBool('is_default').notNull().default(false),
}, (t) => ({
  enabledIdx: index('supported_locales_enabled_idx').on(t.enabled),
}));

/* =========================
   Plans + Subscriptions (partially extracted)
   ========================= */

export const planPackInclusions = pgTable('plan_pack_inclusions', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  included: pgBool('included').notNull().default(true),
}, (t) => ({
  uniq: uniqueIndex('plan_pack_inclusion_uq').on(t.planId, t.packId),
  byPlan: index('plan_pack_plan_idx').on(t.planId),
}));

export const teamSubscriptions = pgTable('team_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  seats: integer('seats').notNull().default(1),
  stripeCustomerId: varchar('stripe_customer_id', { length: 128 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 128 }),
  trialEndsAt: timestamp('trial_ends_at'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAt: timestamp('cancel_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  byTeam: index('team_subs_team_idx').on(t.teamId),
}));

/* =========================
   Payments UX + Tax
   ========================= */

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

export const regionPaymentMethods = pgTable('region_payment_methods', {
  region: varchar('region', { length: 2 }).notNull(),
  methodCode: varchar('method_code', { length: 32 }).notNull()
    .references(() => paymentMethods.code, { onDelete: 'cascade' }),
  enabled: pgBool('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(100),
}, (t) => ({
  uniq: uniqueIndex('rpm_region_method_uq').on(t.region, t.methodCode),
}));

export const taxDisplayPolicies = pgTable('tax_display_policies', {
  country: varchar('country', { length: 2 }).primaryKey(),
  taxLabel: varchar('tax_label', { length: 32 }).notNull().default('tax_included'),
  collectVatId: pgBool('collect_vat_id').notNull().default(false),
  collectNationalId: pgBool('collect_national_id').notNull().default(false),
  reverseChargeEligible: pgBool('reverse_charge_eligible').notNull().default(false),
  note: text('note'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/* =========================
   Stripe / Admin observability
   ========================= */

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 32 }).notNull().default('stripe'),
  eventId: varchar('event_id', { length: 128 }).notNull(),
  eventType: varchar('event_type', { length: 128 }).notNull(),
  payload: jsonb('payload').notNull(),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  status: varchar('status', { length: 16 }).notNull().default('stored'),
  errorMessage: text('error_message'),
}, (t) => ({
  uniqEvent: uniqueIndex('webhook_event_provider_id_uq').on(t.provider, t.eventId),
  byType: index('webhook_event_type_idx').on(t.eventType),
}));

export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: integer('actor_user_id').notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byActor: index('admin_actions_actor_idx').on(t.actorUserId),
  byTarget: index('admin_actions_target_idx').on(t.targetType, t.targetId),
}));

export const adminNotes = pgTable('admin_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorUserId: integer('author_user_id').notNull(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }).notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byEntity: index('admin_notes_entity_idx').on(t.entityType, t.entityId),
}));

/* =========================
   Type exports
   ========================= */

export type ScanJob = typeof scanJobs.$inferSelect;
export type NewScanJob = typeof scanJobs.$inferInsert;

export type FixJob = typeof fixJobs.$inferSelect;
export type NewFixJob = typeof fixJobs.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type GuestSession = typeof guestSessions.$inferSelect;
export type GuestScan = typeof guestScans.$inferSelect;

export type ScheduledScan = typeof scheduledScans.$inferSelect;
export type ScanSummary = typeof scanSummaries.$inferSelect;

export type Snapshot = typeof snapshots.$inferSelect;
export type ChangeSet = typeof changeSets.$inferSelect;
export type ChangeItem = typeof changeItems.$inferSelect;
export type EditJob = typeof editJobs.$inferSelect;

export type AppPack = typeof appPacks.$inferSelect;
export type AppPackPrice = typeof appPackPrices.$inferSelect;

export type SupportedLocale = typeof supportedLocales.$inferSelect;

export type TeamSubscription = typeof teamSubscriptions.$inferSelect;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type RegionPaymentMethod = typeof regionPaymentMethods.$inferSelect;
export type TaxDisplayPolicy = typeof taxDisplayPolicies.$inferSelect;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type AdminAction = typeof adminActions.$inferSelect;
export type AdminNote = typeof adminNotes.$inferSelect;
// export { users };