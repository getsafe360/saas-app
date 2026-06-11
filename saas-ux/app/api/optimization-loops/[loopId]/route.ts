// app/api/optimization-loops/[loopId]/route.ts
// GET  — poll loop status + iterations
// POST — cancel a running loop
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { optimizationLoops, optimizationLoopIterations, sites } from '@/lib/db/schema';
import { getDbUserFromClerk } from '@/lib/auth/current';
import type { LoopStatusResponse } from '@/lib/optimization/loops/types';

type Params = { params: Promise<{ loopId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { loopId } = await params;
  const db = getDb();

  const [loop] = await db
    .select()
    .from(optimizationLoops)
    .where(eq(optimizationLoops.id, loopId))
    .limit(1);

  if (!loop) return NextResponse.json({ error: 'loop not found' }, { status: 404 });

  // Verify caller owns the site
  const [site] = await db
    .select({ userId: sites.userId })
    .from(sites)
    .where(eq(sites.id, loop.siteId))
    .limit(1);

  if (!site || site.userId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const iterations = await db
    .select()
    .from(optimizationLoopIterations)
    .where(eq(optimizationLoopIterations.loopId, loopId))
    .orderBy(optimizationLoopIterations.iterationNumber);

  // Build user-friendly events timeline from iterations
  const events = buildEvents(loop, iterations);

  const response: LoopStatusResponse = {
    id: loop.id,
    siteId: loop.siteId,
    category: loop.category,
    status: loop.status,
    mode: loop.mode,
    startingScore: loop.startingScore,
    currentScore: loop.currentScore,
    goalScore: loop.goalScore,
    currentIteration: loop.currentIteration,
    maxIterations: loop.maxIterations,
    stopReason: loop.stopReason,
    events,
    iterations: iterations.map((it) => ({
      id: it.id,
      iterationNumber: it.iterationNumber,
      issueTitle: it.issueTitle,
      issueSeverity: it.issueSeverity,
      fixType: it.fixType,
      scoreBefore: it.scoreBefore,
      scoreAfter: it.scoreAfter,
      status: it.status,
      verificationResult: it.verificationResult,
      errorMessage: it.errorMessage,
      createdAt: it.createdAt.toISOString(),
      completedAt: it.completedAt?.toISOString() ?? null,
    })),
    createdAt: loop.createdAt.toISOString(),
    updatedAt: loop.updatedAt.toISOString(),
    completedAt: loop.completedAt?.toISOString() ?? null,
  };

  return NextResponse.json(response);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { loopId } = await params;
  const body = await req.json().catch(() => ({})) as { action?: string };

  if (body.action !== 'cancel') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const db = getDb();

  const [loop] = await db
    .select()
    .from(optimizationLoops)
    .where(eq(optimizationLoops.id, loopId))
    .limit(1);

  if (!loop) return NextResponse.json({ error: 'loop not found' }, { status: 404 });

  const [site] = await db
    .select({ userId: sites.userId })
    .from(sites)
    .where(eq(sites.id, loop.siteId))
    .limit(1);

  if (!site || site.userId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const terminal: string[] = ['completed', 'stopped', 'failed', 'rolled_back'];
  if (terminal.includes(loop.status)) {
    return NextResponse.json({ error: 'Loop is already finished.' }, { status: 409 });
  }

  await db
    .update(optimizationLoops)
    .set({ status: 'stopped', stopReason: 'user_cancelled', updatedAt: new Date(), completedAt: new Date() })
    .where(eq(optimizationLoops.id, loopId));

  return NextResponse.json({ ok: true });
}

// ── Events timeline builder ───────────────────────────────────────────────────

function buildEvents(
  loop: typeof optimizationLoops.$inferSelect,
  iterations: (typeof optimizationLoopIterations.$inferSelect)[],
) {
  const events = [];

  events.push({
    type: 'status_change',
    title: 'Loop started',
    status: 'completed' as const,
    message: `Starting ${loop.category.toUpperCase()} optimization (goal: ${loop.goalScore}/100)`,
    timestamp: loop.createdAt.toISOString(),
  });

  for (const it of iterations) {
    if (it.status === 'completed') {
      events.push({
        type: 'fix_applied',
        iterationNumber: it.iterationNumber,
        title: it.issueTitle,
        status: 'completed' as const,
        fixType: it.fixType,
        scoreBefore: it.scoreBefore,
        scoreAfter: it.scoreAfter ?? undefined,
        message: `Applied fix: ${it.issueTitle}`,
        timestamp: (it.completedAt ?? it.createdAt).toISOString(),
      });
    } else if (it.status === 'skipped') {
      const vr = it.verificationResult as Record<string, unknown> | null;
      events.push({
        type: 'fix_skipped',
        iterationNumber: it.iterationNumber,
        title: it.issueTitle,
        status: 'skipped' as const,
        message: vr?.requiresApproval
          ? `Requires your approval: ${it.issueTitle}`
          : `Skipped: ${it.issueTitle}`,
        timestamp: (it.completedAt ?? it.createdAt).toISOString(),
      });
    } else if (it.status === 'failed' || it.status === 'rolled_back') {
      events.push({
        type: 'fix_failed',
        iterationNumber: it.iterationNumber,
        title: it.issueTitle,
        status: 'failed' as const,
        message: it.errorMessage ?? `Fix failed: ${it.issueTitle}`,
        timestamp: (it.completedAt ?? it.createdAt).toISOString(),
      });
    }
  }

  if (loop.completedAt) {
    const stopMessages: Record<string, string> = {
      goal_reached: `Goal reached! Score improved from ${loop.startingScore} to ${loop.currentScore}.`,
      max_iterations_reached: `Completed ${loop.maxIterations} iterations.`,
      no_safe_fixes_available: 'We found additional improvements, but they require your approval before we change the live site.',
      verification_failed: 'A fix could not be verified — the loop stopped safely.',
      connector_unavailable: 'The site connection is unavailable. Reconnect WordPress to continue automated fixes.',
      score_regressed: 'Score regressed after a fix — the loop stopped and the fix was rolled back.',
      user_cancelled: 'Loop cancelled by user.',
      budget_limit_reached: 'Token budget reached.',
      manual_review_required: 'Some fixes require manual review before they can be applied.',
    };

    events.push({
      type: 'loop_complete',
      title: loop.stopReason === 'goal_reached' ? 'Goal reached' : 'Loop stopped',
      status: (loop.status === 'completed' ? 'completed' : 'failed') as any,
      message: stopMessages[loop.stopReason ?? ''] ?? 'Loop finished.',
      timestamp: loop.completedAt.toISOString(),
    });
  }

  return events;
}
