#!/usr/bin/env npx tsx
/**
 * One-time admin bootstrap script.
 *
 * What it does:
 *   1. Sets users.role = 'admin' for the given Clerk user ID
 *   2. Fixes the team's tokensIncluded + tokensRemaining to match the
 *      actual plan (agent = 300 000 tokens).
 *
 * Usage:
 *   cd saas-ux
 *   npx tsx scripts/set-admin.ts
 *
 * Requires DATABASE_URL (or equivalent Drizzle env vars) to be set, e.g.:
 *   DATABASE_URL=postgres://... npx tsx scripts/set-admin.ts
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db/drizzle';
import { users } from '../lib/db/schema/auth/users';
import { teams } from '../lib/db/schema/auth/teams';

// ── Config ────────────────────────────────────────────────────────────────────
const FRANK_CLERK_ID = 'user_3CafPsDobkQ7BMp6UV0VHFGLcbr';
const TEAM_ID = 8;
const AGENT_TOKENS = 300_000; // agent / agency plan allowance
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const db = getDb();

  // 1. Promote user to admin
  const [updatedUser] = await db
    .update(users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(users.clerkUserId, FRANK_CLERK_ID))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (!updatedUser) {
    console.error('❌  User not found for Clerk ID:', FRANK_CLERK_ID);
    process.exit(1);
  }
  console.log('✅  User promoted to admin:', updatedUser);

  // 2. Sync team token allocation to match the agent plan
  const [updatedTeam] = await db
    .update(teams)
    .set({
      tokensIncluded: AGENT_TOKENS,
      tokensRemaining: AGENT_TOKENS,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, TEAM_ID))
    .returning({
      id: teams.id,
      name: teams.name,
      planName: teams.planName,
      tokensIncluded: teams.tokensIncluded,
      tokensRemaining: teams.tokensRemaining,
    });

  if (!updatedTeam) {
    console.error('❌  Team not found for ID:', TEAM_ID);
    process.exit(1);
  }
  console.log('✅  Team tokens synced:', updatedTeam);

  console.log('\nDone. Add the following env var to skip rate limits and token gates:');
  console.log(`  ADMIN_CLERK_USER_IDS=${FRANK_CLERK_ID}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
