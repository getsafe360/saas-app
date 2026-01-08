// lib/db/schema/admin/actions.ts
// Admin actions and notes

import {
  pgTable, uuid, integer, varchar, text, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';

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

// Type exports
export type AdminAction = typeof adminActions.$inferSelect;
export type AdminNote = typeof adminNotes.$inferSelect;
