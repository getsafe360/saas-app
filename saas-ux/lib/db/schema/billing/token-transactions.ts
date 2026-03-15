import { pgEnum, pgTable, uuid, integer, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from '@/lib/db/schema/auth/teams';

export const tokenTransactionTypeEnum = pgEnum('token_transaction_type', [
  'purchase',
  'auto_replenish',
  'bonus',
  'admin_adjustment',
  'burn',
]);

export const tokenTransactions = pgTable('token_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  amountTokens: integer('amount_tokens').notNull(),
  amountEur: numeric('amount_eur', { precision: 10, scale: 2 }),
  type: tokenTransactionTypeEnum('type').notNull(),
  stripePaymentId: text('stripe_payment_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type TokenTransaction = typeof tokenTransactions.$inferSelect;
export type NewTokenTransaction = typeof tokenTransactions.$inferInsert;
