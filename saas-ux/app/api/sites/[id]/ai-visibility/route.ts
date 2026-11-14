// app/api/sites/[id]/ai-visibility/route.ts
// GET: the tracked questions, the latest visibility run, the score history and
// what the plan allows.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { topCompetitors } from '@/lib/ai-visibility/analyze';
import { QUESTION_LIMIT, WEEKLY_PLANS } from '@/lib/ai-visibility/config';
import { siteForUser } from '@/lib/ai-visibility/service';
import { loadQuestions, loadRuns, trialUsed } from '@/lib/ai-visibility/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const site = await siteForUser(userId, siteId);
  if (!site) return NextResponse.json({ error: 'SITE_NOT_FOUND' }, { status: 404 });

  const [questions, runs, trial] = await Promise.all([
    loadQuestions(siteId),
    loadRuns(siteId),
    site.teamId === null ? Promise.resolve(true) : trialUsed(site.teamId),
  ]);
  const latest = runs[0] ?? null;
  const weekly = WEEKLY_PLANS.has(site.plan);
  return NextResponse.json({
    questions: questions?.questions ?? [],
    language: questions?.language ?? null,
    latest,
    competitors: latest ? topCompetitors(latest) : [],
    history: runs.map((run) => ({ checkedAt: run.checkedAt, score: run.score })).reverse(),
    plan: {
      name: site.plan,
      questionLimit: QUESTION_LIMIT[site.plan],
      weekly,
      // Free plans get one trial run per team; paid plans check now with tokens.
      canRun: weekly || !trial,
      trialUsed: !weekly && trial,
    },
  });
}
