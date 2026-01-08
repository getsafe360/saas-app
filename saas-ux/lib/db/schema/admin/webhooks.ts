// lib/db/schema/admin/webhooks.ts
// Webhook event logging

import {
  pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex
} from 'drizzle-orm/pg-core';

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

// Type exports
export type WebhookEvent = typeof webhookEvents.$inferSelect;
