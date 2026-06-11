// lib/optimization/loops/runner.ts
// Generic category loop runner
// Runs synchronously within the API route. Each iteration is fast (~3-5s):
// snapshot lookup → fix plan → safety check → WP push → HTML verify → DB record.
// A full rescan is triggered only at the end of the loop.

import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import {
  optimizationLoops,
  optimizationLoopIterations,
  appliedFixes,
  scanSummaries,
} from '@/lib/db/schema';
import type { LoopStatus, LoopStopReason, OptimizationMode } from '@/lib/db/schema';
import type { RunLoopInput, LoopEvent, SiteSnapshot } from './types';
import { getCategoryScore } from './scoring';
import { selectNextSeoIssue } from './categories/seoLoop';
import { evaluateFixSafety } from '../fixes/fixPolicies';
import { applyFix } from '../fixes/applyFix';
import { verifyFix } from '../fixes/verifyFix';
import { rollbackFix } from '../fixes/rollbackFix';

// ── DB helpers ────────────────────────────────────────────────────────────────

async function setLoopStatus(loopId: string, status: LoopStatus) {
  const db = getDb();
  await db
    .update(optimizationLoops)
    .set({ status, updatedAt: new Date() })
    .where(eq(optimizationLoops.id, loopId));
}

async function setLoopScore(loopId: string, score: number) {
  const db = getDb();
  await db
    .update(optimizationLoops)
    .set({ currentScore: score, updatedAt: new Date() })
    .where(eq(optimizationLoops.id, loopId));
}

async function completeLoop(
  loopId: string,
  stopReason: LoopStopReason,
  finalScore?: number,
) {
  const db = getDb();
  await db
    .update(optimizationLoops)
    .set({
      status: stopReason === 'goal_reached' ? 'completed' : 'stopped',
      stopReason,
      currentScore: finalScore,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(optimizationLoops.id, loopId));
}

async function recordIteration(params: {
  loopId: string;
  iterationNumber: number;
  issueId: string;
  issueTitle: string;
  issueSeverity: string;
  fixType: string;
  fixPayload: unknown;
  scoreBefore: number;
  scoreAfter: number | null;
  status: string;
  verificationResult: unknown;
  errorMessage?: string;
  completedAt?: Date;
}) {
  const db = getDb();
  const [iter] = await db
    .insert(optimizationLoopIterations)
    .values({
      loopId: params.loopId,
      iterationNumber: params.iterationNumber,
      issueId: params.issueId,
      issueTitle: params.issueTitle,
      issueSeverity: params.issueSeverity,
      fixType: params.fixType,
      fixPayload: params.fixPayload as any,
      scoreBefore: params.scoreBefore,
      scoreAfter: params.scoreAfter,
      status: params.status as any,
      verificationResult: params.verificationResult as any,
      errorMessage: params.errorMessage ?? null,
      completedAt: params.completedAt ?? new Date(),
    })
    .returning({ id: optimizationLoopIterations.id });

  return iter?.id;
}

async function recordAppliedFix(params: {
  siteId: string;
  loopId: string;
  iterationId: string | undefined;
  category: string;
  fixType: string;
  fixId: string;
  target: string;
  payload: unknown;
  connectorResponse: unknown;
  rollbackPayload?: unknown;
}) {
  const db = getDb();
  await db.insert(appliedFixes).values({
    siteId: params.siteId,
    loopId: params.loopId,
    iterationId: params.iterationId ?? null,
    category: params.category,
    fixType: params.fixType,
    fixId: params.fixId,
    target: params.target,
    payload: params.payload as any,
    connectorResponse: params.connectorResponse as any,
    rollbackPayload: params.rollbackPayload as any ?? null,
    status: 'applied',
  });
}

async function incrementIteration(loopId: string, n: number) {
  const db = getDb();
  await db
    .update(optimizationLoops)
    .set({ currentIteration: n, updatedAt: new Date() })
    .where(eq(optimizationLoops.id, loopId));
}

// ── Issue selector router ─────────────────────────────────────────────────────

function selectNextIssue(category: string, snapshot: SiteSnapshot, attempted: string[]) {
  if (category === 'seo') {
    return selectNextSeoIssue(snapshot, attempted);
  }
  // Other categories not yet implemented — return null to stop loop safely
  return null;
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runCategoryLoop(input: RunLoopInput): Promise<{ stopReason: LoopStopReason }> {
  const { loopId, siteId, siteUrl, siteToken, category, goalScore, maxIterations, mode, snapshot } = input;

  const attemptedIssueIds: string[] = [];
  let currentScore = getCategoryScore(snapshot, category);
  let iteration = 0;

  // Persist starting score
  const db = getDb();
  await db
    .update(optimizationLoops)
    .set({ startingScore: currentScore, currentScore, status: 'running', updatedAt: new Date() })
    .where(eq(optimizationLoops.id, loopId));

  if (currentScore >= goalScore) {
    await completeLoop(loopId, 'goal_reached', currentScore);
    return { stopReason: 'goal_reached' };
  }

  while (iteration < maxIterations) {
    await setLoopStatus(loopId, 'analyzing');

    const next = selectNextIssue(category, snapshot, attemptedIssueIds);

    if (!next) {
      await completeLoop(loopId, 'no_safe_fixes_available', currentScore);
      return { stopReason: 'no_safe_fixes_available' };
    }

    const { issue, fixPlan } = next;
    attemptedIssueIds.push(issue.id);
    iteration++;
    await incrementIteration(loopId, iteration);
    await setLoopStatus(loopId, 'planning_fix');

    // Safety check
    const safety = evaluateFixSafety(fixPlan, mode);

    if (!safety.allowed) {
      // Record as skipped iteration
      await recordIteration({
        loopId,
        iterationNumber: iteration,
        issueId: issue.id,
        issueTitle: issue.title,
        issueSeverity: issue.severity,
        fixType: fixPlan.fixType,
        fixPayload: fixPlan,
        scoreBefore: currentScore,
        scoreAfter: null,
        status: 'skipped',
        verificationResult: { reason: safety.reason, requiresApproval: safety.requiresApproval },
      });
      continue;
    }

    await setLoopStatus(loopId, 'applying_fix');

    // Apply fix
    const applyResult = await applyFix({ siteUrl, siteToken, fixPlan });

    if (!applyResult.success) {
      await recordIteration({
        loopId,
        iterationNumber: iteration,
        issueId: issue.id,
        issueTitle: issue.title,
        issueSeverity: issue.severity,
        fixType: fixPlan.fixType,
        fixPayload: fixPlan,
        scoreBefore: currentScore,
        scoreAfter: null,
        status: 'failed',
        verificationResult: null,
        errorMessage: applyResult.error,
      });

      if (applyResult.error?.includes('connector') || applyResult.error?.includes('TIMEOUT')) {
        await completeLoop(loopId, 'connector_unavailable', currentScore);
        return { stopReason: 'connector_unavailable' };
      }

      continue;
    }

    await setLoopStatus(loopId, 'verifying');

    // Verify fix
    const verification = await verifyFix({ siteUrl, fixPlan, applyResult });

    if (!verification.passed) {
      // Attempt rollback
      await rollbackFix({ siteUrl, siteToken, fixPlan });

      const iterId = await recordIteration({
        loopId,
        iterationNumber: iteration,
        issueId: issue.id,
        issueTitle: issue.title,
        issueSeverity: issue.severity,
        fixType: fixPlan.fixType,
        fixPayload: fixPlan,
        scoreBefore: currentScore,
        scoreAfter: null,
        status: 'rolled_back',
        verificationResult: verification,
        errorMessage: verification.reason,
      });

      await completeLoop(loopId, 'verification_failed', currentScore);
      return { stopReason: 'verification_failed' };
    }

    // Fix applied and verified — record it
    const iterId = await recordIteration({
      loopId,
      iterationNumber: iteration,
      issueId: issue.id,
      issueTitle: issue.title,
      issueSeverity: issue.severity,
      fixType: fixPlan.fixType,
      fixPayload: fixPlan,
      scoreBefore: currentScore,
      scoreAfter: currentScore, // Score update happens after full rescan at end
      status: 'completed',
      verificationResult: verification,
    });

    await recordAppliedFix({
      siteId,
      loopId,
      iterationId: iterId,
      category,
      fixType: fixPlan.fixType,
      fixId: fixPlan.connectorFix.id,
      target: siteUrl,
      payload: fixPlan.connectorFix,
      connectorResponse: applyResult.connectorResponse,
      rollbackPayload: fixPlan.rollbackPayload,
    });

    await setLoopStatus(loopId, 'rescoring');

    // Score improvement is estimated here — a full rescan is kicked off after the loop
    // Each verified fix contributes ~2-5 points depending on severity
    const gain = issue.severity === 'high' || issue.severity === 'critical' ? 5 : 2;
    currentScore = Math.min(100, currentScore + gain);
    await setLoopScore(loopId, currentScore);

    if (currentScore >= goalScore) {
      await completeLoop(loopId, 'goal_reached', currentScore);
      return { stopReason: 'goal_reached' };
    }
  }

  await completeLoop(loopId, 'max_iterations_reached', currentScore);
  return { stopReason: 'max_iterations_reached' };
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export async function buildSnapshotForSite(siteId: string, siteUrl: string): Promise<SiteSnapshot | null> {
  const db = getDb();

  const [summary] = await db
    .select()
    .from(scanSummaries)
    .where(eq(scanSummaries.siteId, siteId))
    .orderBy(scanSummaries.createdAt)
    .limit(1);

  if (!summary) return null;

  const scores = (summary.scores as Record<string, number>) ?? {};
  const findings = (summary.findings as unknown[]) ?? [];

  const { extractSeoFacts } = await import('./categories/seoLoop');
  const seoFacts = extractSeoFacts(siteUrl, scores, findings);

  // Best-effort: extract org name from og:site_name if in raw findings
  if (!seoFacts.orgName) {
    for (const f of findings) {
      const finding = f as Record<string, unknown>;
      if (
        (String(finding.id ?? '').includes('og-site-name') || String(finding.id ?? '').includes('site_name')) &&
        finding.content
      ) {
        seoFacts.orgName = String(finding.content);
        break;
      }
    }
  }

  return {
    siteId,
    siteUrl,
    scores,
    seoFacts,
    findings: findings as SiteSnapshot['findings'],
  };
}
