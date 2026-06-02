// lib/db/schema/sites/backups.ts
import {
  pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, pgEnum
} from 'drizzle-orm/pg-core';
import { sites } from './sites';

export const backupMethodEnum = pgEnum('backup_method', [
  'checkpoint', 'wordpress-plugin', 'ssh'
]);

export const backupStatusEnum = pgEnum('backup_status', [
  'creating', 'ready', 'restoring', 'failed'
]);

export const siteBackups = pgTable('site_backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  method: backupMethodEnum('method').notNull().default('checkpoint'),
  status: backupStatusEnum('status').notNull().default('creating'),
  blobKey: text('blob_key').notNull(),
  includes: jsonb('includes').notNull().$type<string[]>(),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (t) => ({
  bySite: index('site_backups_site_idx').on(t.siteId),
  bySiteStatus: index('site_backups_site_status_idx').on(t.siteId, t.status),
}));

export type SiteBackup = typeof siteBackups.$inferSelect;
export type NewSiteBackup = typeof siteBackups.$inferInsert;
