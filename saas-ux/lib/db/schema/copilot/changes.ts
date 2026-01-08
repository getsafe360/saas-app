// lib/db/schema/copilot/changes.ts
// Co-pilot snapshots, changesets, and change items

import {
  pgTable, uuid, integer, varchar, text, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { changeSetStatusEnum } from '../_shared/enums';
import { sites } from '../sites/sites';
import { users } from '../auth/users';

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
  changeSetId: uuid('change_set_id').notNull().references(() => changeSets.id, { onDelete: 'cascade' }),
  op: varchar('op', { length: 16 }).notNull(),
  path: text('path').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byChangeSet: index('change_items_cs_idx').on(t.changeSetId),
}));

// Type exports
export type Snapshot = typeof snapshots.$inferSelect;
export type ChangeSet = typeof changeSets.$inferSelect;
export type ChangeItem = typeof changeItems.$inferSelect;
