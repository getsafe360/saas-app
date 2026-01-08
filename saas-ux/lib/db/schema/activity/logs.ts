// lib/db/schema/activity/logs.ts
// Activity logging

import {
  pgTable, serial, integer, varchar, uuid, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { activityEventEnum } from '../_shared/enums';
import { users } from '../auth/users';
import { teams } from '../auth/teams';
import { sites } from '../sites/sites';

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

// Type exports
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
