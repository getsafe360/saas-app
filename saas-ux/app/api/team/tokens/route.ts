// app/api/team/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { getDbUserFromClerk } from '@/lib/auth/current';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const db = getDb();

  const dbUser = await getDbUserFromClerk();
  if (!dbUser) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  const row = await db
    .select({ tokensRemaining: teams.tokensRemaining })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, dbUser.id))
    .limit(1);

  return NextResponse.json({ tokensRemaining: row[0]?.tokensRemaining ?? 0 });
}
