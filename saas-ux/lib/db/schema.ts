// saas-ux/lib/db/schema.ts
import {
pgTable, varchar, integer, text, timestamp, jsonb, serial, uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from "drizzle-orm";

/**
 * USERS — single source of truth
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  language: varchar('language', { length: 5 }).notNull().default('en'),
  // Clerk integration
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
  // Stripe at user level (simple)
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  // Timestamps / status
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

/**
 * SITES — owned by a single user for now.
 * Use the same id the handshake generates (text/uuid/short hash).
 */
export const sites = pgTable('sites', {
  id: text('id').primaryKey(), // e.g., the siteId used in handshake
  userId: integer('user_id').notNull().references(() => users.id),
  siteUrl: text('site_url').notNull().unique(),  // normalized URL
  status: varchar('status', { length: 20 }).notNull().default('connected'),
  cms: varchar('cms', { length: 20 }).notNull().default('wordpress'),
  wpVersion: varchar('wp_version', { length: 20 }),
  pluginVersion: varchar('plugin_version', { length: 20 }),
  tokenHash: text('token_hash'), // sha256(siteToken)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userUrlUnique: uniqueIndex('sites_user_url_unique').on(t.userId, t.siteUrl),
}));

/**
 * SCAN JOBS — 1..n per site, stores pointer to Blob report.
 */
export const scanJobs = pgTable("scan_jobs", {
  id: text("id").primaryKey(),                   // uuid
  siteId: text("site_id").notNull().references(() => sites.id),
  status: text("status").notNull().default("queued"), // queued|running|done|error
  categories: text("categories").notNull(),      // e.g. "seo,performance,accessibility,security"
  agentUsed: text("agent_used"),                 // "external" | "fallback"
  costTokens: integer("cost_tokens").default(0),
  reportBlobKey: text("report_blob_key"),        // reports/<siteId>/<jobId>.json
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().default(sql`now()`),
});

/**
 * ACTIVITY LOGS — logs for the user, optionally scoped to a site.
 * teamId is now OPTIONAL so you can log without teams.
 */
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  teamId: integer('team_id').references(() => teams.id),
  siteId: text('site_id').references(() => sites.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const fixJobs = pgTable('fix_jobs', {
  id: varchar('id', { length: 64 }).primaryKey(), // uuid
  siteId: varchar('site_id', { length: 64 }).notNull(),
  teamId: integer('team_id').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('queued'), // 'queued'|'running'|'done'|'error'
  issues: jsonb('issues').$type<{ id: string; estTokens: number }[]>().notNull(),
  estTokens: integer('est_tokens').notNull(),
  agentUsed: varchar('agent_used', { length: 64 }),
  resultBlobKey: varchar('result_blob_key', { length: 256 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  tokensRemaining: integer('tokens_remaining').notNull().default(50000), // starter quota
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

/** Relations (optional for now) */
export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  // you can add: sites: many(sites) later if you want helper APIs
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
}));

/** Types */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type ScanJob = typeof scanJobs.$inferSelect;
export type NewScanJob = typeof scanJobs.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

// Legacy helper type used by some middleware; safe to keep.
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
