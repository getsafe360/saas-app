// app/api/sites/[id]/ai-visibility/run/route.ts
// POST: "Check now". Free plans: one trial run per team (no tokens). Paid plans:
// draws tokens at what the run costs.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql, eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { teams } from '@/lib/db/schema/auth/teams';
import { getAvailableTokens } from '@/lib/fix/tokens';
import { topCompetitors } from '@/lib/ai-visibility/analyze';
import { hasVisibilityKey } from '@/lib/ai-visibility/claude';
import { ESTIMATED_TOKENS_PER_QUESTION, QUESTION_LIMIT, WEEKLY_PLANS } from '@/lib/ai-visibility/config';
import { crawlFor, runVisibility, siteForUser } from '@/lib/ai-visibility/service';
import { acquireRunLock, claimTrial, loadQuestions, releaseRunLock, releaseTrial } from '@/lib/ai-visibility/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const site = await siteForUser(userId, siteId);
  if (!site) return NextResponse.json({ error: 'SITE_NOT_FOUND' }, { status: 404 });
  if (!hasVisibilityKey()) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 });

  const set = await loadQuestions(siteId);
  const questions = (set?.questions ?? []).slice(0, QUESTION_LIMIT[site.plan]);
  if (!set || questions.length === 0) return NextResponse.json({ error: 'NO_QUESTIONS' }, { status: 400 });

  const paid = WEEKLY_PLANS.has(site.plan);
  if (paid) {
    if (site.teamId === null) return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', tokensRemaining: 0 }, { status: 402 });
    const { available } = await getAvailableTokens(site.teamId);
    if (available < questions.length * ESTIMATED_TOKENS_PER_QUESTION) {
      return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', tokensRemaining: available }, { status: 402 });
    }
  }

  if (!(await acquireRunLock(siteId))) return NextResponse.json({ error: 'ALREADY_RUNNING' }, { status: 409 });
  try {
    const crawl = await crawlFor(site);
    if (!crawl) return NextResponse.json({ error: 'SITE_UNREACHABLE' }, { status: 502 });
    if (!paid && (site.teamId === null || !(await claimTrial(site.teamId)))) {
      return NextResponse.json({ error: 'TRIAL_USED' }, { status: 402 });
    }

    const run = await runVisibility({ site, crawl, questions, language: set.language, trigger: paid ? 'manual' : 'trial' });
    if (run.results.every((result) => result.error)) {
      // Nothing was measured: a free trial is given back.
      if (!paid && site.teamId !== null) await releaseTrial(site.teamId);
      return NextResponse.json({ error: 'RUN_FAILED' }, { status: 502 });
    }

    if (paid && site.teamId !== null && run.tokensUsed > 0) {
      await getDrizzle()
        .update(teams)
        .set({
          tokensUsedThisMonth: sql`${teams.tokensUsedThisMonth} + ${run.tokensUsed}`,
          tokensRemaining: sql`GREATEST(0, ${teams.tokensRemaining} - ${run.tokensUsed})`,
        })
        .where(eq(teams.id, site.teamId));
    }
    return NextResponse.json({ run, competitors: topCompetitors(run), charged: paid ? run.tokensUsed : 0 });
  } finally {
    await releaseRunLock(siteId);
  }
}
