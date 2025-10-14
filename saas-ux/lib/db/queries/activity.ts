import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../drizzle';
import { activityLogs, users } from '../schema';
import { requireUser } from './auth';

export async function getActivityLogs(opts: { limit?: number; offset?: number } = {}) {
  const { limit = 10, offset = 0 } = opts;
  const user = await requireUser();
  const db = getDb();

  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(limit)
    .offset(offset);
}
