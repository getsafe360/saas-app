// lib/db/queries/activity.ts
import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../drizzle';
import { activityLogs } from '../schema';
import { requireUser } from './auth';
import { users } from '../schema/auth/users';

export async function getActivityLogs(opts: { limit?: number; offset?: number } = {}) {
  const { limit = 10, offset = 0 } = opts;
  const user = await requireUser();
  const db = getDb();

  // action: prefer JSONB data.action; fallback to event
  const actionExpr = sql<string>`coalesce(${activityLogs.data} ->> 'action', ${activityLogs.event})`;

  return db
    .select({
      id: activityLogs.id,
      action: actionExpr,                 // derived string
      timestamp: activityLogs.createdAt,  // use createdAt as timestamp
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

