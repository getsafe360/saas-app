// app/api/sites/[id]/ai-visibility/run/route.ts
// POST: "Check now". Free plans: one trial run per team (no tokens). Paid plans:
// reserve the most the run may cost, then pay what it cost (never more).

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { reserveTokens, settleTokens } from '@/lib/ai-visibility/billing';
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
  if (paid && site.teamId === null) return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', tokensRemaining: 0 }, { status: 402 });
  if (!(await acquireRunLock(siteId))) return NextResponse.json({ error: 'ALREADY_RUNNING' }, { status: 409 });

  // Paid checks reserve their most expensive case before anything runs; settled below.
  const reserved = paid ? questions.length * ESTIMATED_TOKENS_PER_QUESTION : 0;
  let settled = !paid;
  try {
    if (paid) {
      const reservation = await reserveTokens(site.teamId!, reserved);
      if (!reservation.ok) {
        settled = true;
        return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', tokensRemaining: reservation.available }, { status: 402 });
      }
    }

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

    const charged = paid ? await settleTokens(site.teamId!, reserved, run.tokensUsed) : 0;
    settled = true;
    return NextResponse.json({ run, competitors: topCompetitors(run), charged });
  } finally {
    // Whatever ended the run early, the reservation goes back (the API calls made so far are on us).
    if (!settled) await settleTokens(site.teamId!, reserved, 0).catch(() => undefined);
    await releaseRunLock(siteId);
  }
}
