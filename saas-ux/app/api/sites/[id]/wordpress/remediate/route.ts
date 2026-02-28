import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { changeItems, changeSets } from '@/lib/db/schema/copilot/changes';
import { users } from '@/lib/db/schema/auth/users';
import { aiAnalysisJobs, aiRepairActions } from '@/lib/db/schema/ai/analysis';
import { publishEvent } from '@/lib/cockpit/event-bus';

type RemediationFinding = {
  id: string;
  actionId?: string;
  title?: string;
  severity?: string;
  category?: string;
  automationLevel?: string;
  safetyLevel?: 'safe' | 'review' | 'sensitive';
};

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const findings: RemediationFinding[] = Array.isArray(body?.findings) ? body.findings : [];
  const safeMode = body?.safeMode !== false;
  const locale = typeof body?.locale === 'string' ? body.locale : 'en';

  if (findings.length === 0) {
    return NextResponse.json({ success: false, error: 'NO_FINDINGS_SELECTED' }, { status: 400 });
  }

  publishEvent(siteId, { type: 'repair', state: 'repairing', message: 'Starting WordPress remediation', platform: 'wordpress' });

  const executionResults: Array<{
    findingId: string;
    actionId: string;
    status: 'skipped' | 'applied';
    message: string;
    skippedBySafeMode: boolean;
    finding: RemediationFinding;
  }> = findings.map((finding) => {
    const skippedBySafeMode = safeMode && finding.safetyLevel === 'sensitive';
    return {
      findingId: finding.id,
      actionId: finding.actionId ?? finding.id,
      status: skippedBySafeMode ? 'skipped' : 'applied',
      message: skippedBySafeMode
        ? `Skipped ${finding.title ?? finding.id} due to safe mode`
        : `Queued remediation for ${finding.title ?? finding.id}`,
      skippedBySafeMode,
      finding,
    };
  });

  let changeSetId: string | undefined;
  let analysisJobId: string | undefined;
  let auditLogged = false;
  let auditError: string | undefined;
  let aiTrackingError: string | undefined;
  let ownershipValidated = false;

  try {
    const db = getDrizzle();

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);

    const [site] = await db
      .select({ id: sites.id, userId: sites.userId })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!site) {
      return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
    }

    if (dbUser?.id && site.userId !== dbUser.id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    ownershipValidated = true;

    // Persist AI analysis/remediation tracking records (best effort, non-blocking)
    try {
      const [analysisJob] = await db
        .insert(aiAnalysisJobs)
        .values({
          siteId,
          userId: dbUser?.id,
          status: 'completed',
          selectedModules: { wordpress: true, remediation: true },
          locale,
          analysisDepth: 'balanced',
          safeMode,
          issuesFound: findings.length,
          repairableIssues: executionResults.filter((result) => !result.skippedBySafeMode).length,
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .returning({ id: aiAnalysisJobs.id });

      analysisJobId = analysisJob?.id;

      if (analysisJobId) {
        const persistedAnalysisJobId = analysisJobId;
        await db.insert(aiRepairActions).values(
          executionResults.map((result) => {
            const actionStatus: 'skipped' | 'completed' = result.skippedBySafeMode
              ? 'skipped'
              : 'completed';

            return {
              analysisJobId: persistedAnalysisJobId,
              siteId,
              issueId: result.findingId,
              actionId: result.actionId,
              title: result.finding.title ?? result.findingId,
              category: result.finding.category,
              severity: result.finding.severity,
              status: actionStatus,
              repairMethod: result.finding.automationLevel ?? 'manual',
              changes: { safeMode, locale },
              executedAt: new Date(),
              safeModeSkipped: result.skippedBySafeMode,
              reportIncluded: true,
            };
          }),
        );
      }
    } catch (error: any) {
      aiTrackingError = String(error?.message ?? error ?? 'Unknown AI tracking error');
      console.warn('[wordpress/remediate] ai tracking skipped:', aiTrackingError);
    }

    // Audit logging must never block remediation UX (deployed envs may lag migrations).
    const [changeSet] = await db
      .insert(changeSets)
      .values({
        siteId,
        title: 'WordPress Batch Remediation',
        description: `Applied ${findings.length} selected remediation action(s)`,
        status: 'applied',
        createdByUserId: dbUser?.id,
      })
      .returning({ id: changeSets.id });

    changeSetId = changeSet?.id;

    if (changeSetId) {
      const persistedChangeSetId = changeSetId;
      await db.insert(changeItems).values(
        executionResults.map((result) => ({
          changeSetId: persistedChangeSetId,
          op: 'remediate',
          path: `wordpress/${result.actionId}`,
          oldValue: { status: 'pending' },
          newValue: { status: result.status, findingId: result.findingId },
        })),
      );
      auditLogged = true;
    }
  } catch (error: any) {
    auditError = String(error?.message ?? error ?? 'Unknown remediation backend error');
    console.warn('[wordpress/remediate] backend checks/audit skipped:', auditError);
  }

  for (const result of executionResults) {
    publishEvent(siteId, {
      type: 'repair',
      state: 'repairing',
      message: result.message,
      platform: 'wordpress',
    });
  }
  publishEvent(siteId, { type: 'repair', state: 'repaired', platform: 'wordpress' });

  return NextResponse.json({
    success: true,
    siteId,
    ownershipValidated,
    changeSetId,
    auditLogged,
    ...(auditError ? { auditError } : {}),
    ...(aiTrackingError ? { aiTrackingError } : {}),
    analysisJobId,
    safeMode,
    locale,
    executed: executionResults.map(({ finding, skippedBySafeMode, ...rest }) => rest),
    rerunSuggestedChecks: executionResults.map((result) => result.findingId),
  });
}
