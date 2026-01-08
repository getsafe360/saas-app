// lib/db/schema/billing/subscriptions.ts
// Team subscriptions and plan-pack inclusions

import {
  pgTable, uuid, integer, varchar, timestamp, boolean as pgBool, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { teams } from '../auth/teams';
import { plans } from './plans';
import { appPacks } from '../packs/catalog';

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

export const planPackInclusions = pgTable('plan_pack_inclusions', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  included: pgBool('included').notNull().default(true),
}, (t) => ({
  uniq: uniqueIndex('plan_pack_inclusion_uq').on(t.planId, t.packId),
  byPlan: index('plan_pack_plan_idx').on(t.planId),
}));

// Type exports
export type TeamSubscription = typeof teamSubscriptions.$inferSelect;
