// lib/db/schema/auth/teams.ts
// Team management, members, and invitations

import { pgTable, serial, integer, varchar, text, timestamp, uniqueIndex, boolean, numeric } from 'drizzle-orm/pg-core';
import { users } from './users';

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // Stripe integration
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),

  // Plan and subscription
  planName: varchar('plan_name', { length: 50 }).notNull().default('free'),
  subscriptionStatus: varchar('subscription_status', { length: 20 }).notNull().default('active'),

  // Token tracking for usage-based billing
  tokensIncluded: integer('tokens_included').notNull().default(5000),
  tokensUsedThisMonth: integer('tokens_used_this_month').notNull().default(0),
  tokensPurchased: integer('tokens_purchased').notNull().default(0),
  tokensPurchasedThisMonth: integer('tokens_purchased_this_month').notNull().default(0),
  tokensPurchasedThisMonthEur: numeric('tokens_purchased_this_month_eur', { precision: 10, scale: 2 }).notNull().default('0'),
  tokensRemaining: integer('tokens_remaining').notNull().default(5000),

  // Auto replenish and low-token UI state
  autoReplenishEnabled: boolean('auto_replenish_enabled').notNull().default(false),
  showLowTokenBanner: boolean('show_low_token_banner').notNull().default(false),
  lastPurchasedPackId: varchar('last_purchased_pack_id', { length: 50 }),

  // Billing cycle management
  billingCycleStart: timestamp('billing_cycle_start').notNull().defaultNow(),

  // Usage notifications
  notifiedAt80Percent: boolean('notified_at_80_percent').notNull().default(false),
  notifiedAt100Percent: boolean('notified_at_100_percent').notNull().default(false),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => ({
  uniqMember: uniqueIndex('team_members_team_user_uq').on(t.teamId, t.userId),
}));

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by').notNull().references(() => users.id, { onDelete: 'set null' }),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
}, (t) => ({
  invitedToOnce: uniqueIndex('invitations_team_email_uq').on(t.teamId, t.email),
}));

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
