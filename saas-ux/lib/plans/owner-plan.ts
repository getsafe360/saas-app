// lib/plans/owner-plan.ts
//
// The plan (and team) of the user who owns a site. Reports and the cockpit's
// report card decide what to offer from it.

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { isPlanName, type PlanName } from './config';

export async function getOwnerTeam(userId: number | null): Promise<{ teamId: number | null; planName: PlanName }> {
  if (!userId) return { teamId: null, planName: 'free' };
  const [row] = await getDb()
    .select({ teamId: teamMembers.teamId, planName: teams.planName })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return { teamId: row?.teamId ?? null, planName: isPlanName(row?.planName) ? row.planName : 'free' };
}

export async function getOwnerPlan(userId: number | null): Promise<PlanName> {
  return (await getOwnerTeam(userId)).planName;
}
