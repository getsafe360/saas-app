import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { changeItems, changeSets } from '@/lib/db/schema/copilot/changes';
import { users } from '@/lib/db/schema/auth/users';
import { aiAnalysisJobs, aiRepairActions } from '@/lib/db/schema/ai/analysis';
import { publishEvent } from '@/lib/cockpit/event-bus';
import { createWordPressClient } from '@/lib/wordpress/client';
import { createWordPressActionPlan, type RemediationFindingInput } from '@/lib/wordpress/plan';
import { executeWordPressActionPlan } from '@/lib/wordpress/actions';
import type {
  WordPressCapabilitySummary,
  WordPressDetailedVerificationResult,
  WordPressSiteSnapshot,
} from '@/lib/wordpress/types';

type PersistedExecutionResult = {
  findingId: string;
  actionId: string;
  title: string;
  status: 'applied' | 'skipped' | 'failed';
  applied: boolean;
  autoApplied: boolean;
  message: string;
  skippedBySafeMode: boolean;
  requiresApproval: boolean;
  verification?: WordPressDetailedVerificationResult;
  connectorResult?: unknown;
  rollback?: unknown;
};

function normalizeCapabilities(raw: Record<string, boolean>): WordPressCapabilitySummary {
  return {
    read: true,
    write: Object.values(raw).some(Boolean),
    themeFiles: Boolean(raw.optionUpdate),
    mediaUpload: Boolean(raw.mediaAltUpdate),
    pageUpdate: Boolean(raw.headSnippetInjection || raw.jsonLdInjection || raw.metaTagInjection),
    rollback: Boolean(raw.rollback || raw.snippetDelete),
    raw,
  };
}

function inferBuilderFromPull(pull: { plugins?: string[]; theme?: string }): WordPressSiteSnapshot['builder'] {
  const theme = (pull.theme ?? '').toLowerCase();
  const plugins = (pull.plugins ?? []).map((plugin) => plugin.toLowerCase());

  if (theme.includes('divi') || plugins.some((plugin) => plugin.includes('divi') || plugin.includes('et-core-plugin'))) {
    return 'divi';
  }
  if (plugins.some((plugin) => plugin.includes('elementor'))) {
    return 'elementor';
  }
  if (plugins.some((plugin) => plugin.includes('bricks'))) {
    return 'bricks';
  }
  if (plugins.some((plugin) => plugin.includes('beaver-builder'))) {
    return 'beaver';
  }
  if (plugins.some((plugin) => plugin.includes('oxygen'))) {
    return 'oxygen';
  }
  if (plugins.some((plugin) => plugin.includes('gutenberg'))) {
    return 'gutenberg';
  }

  return 'unknown';
}

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
  const findings: RemediationFindingInput[] = Array.isArray(body?.findings) ? body.findings : [];
  const safeMode = body?.safeMode !== false;
  const locale = typeof body?.locale === 'string' ? body.locale : 'en';

  if (findings.length === 0) {
    return NextResponse.json({ success: false, error: 'NO_FINDINGS_SELECTED' }, { status: 400 });
  }

  publishEvent(siteId, {
    type: 'repair',
    state: 'repairing',
    message: 'Planning WordPress remediation actions',
    platform: 'wordpress',
  });

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) {
    return NextResponse.json({ success: false, error: 'USER_NOT_SYNCED' }, { status: 401 });
  }

  const [site] = await db
    .select({
      id: sites.id,
      userId: sites.userId,
      siteUrl: sites.siteUrl,
      tokenHash: sites.tokenHash,
      wordpressConnection: sites.wordpressConnection,
      isConnected: sites.isConnected,
      connectionStatus: sites.connectionStatus,
    })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }

  const tokenHash =
    site.tokenHash ||
    ((site.wordpressConnection as { tokenHash?: string } | null)?.tokenHash ?? null);

  if (!tokenHash || !site.isConnected || site.connectionStatus !== 'connected') {
    return NextResponse.json(
      { success: false, error: 'WORDPRESS_NOT_CONNECTED' },
      { status: 422 },
    );
  }

  const allowedFindings = safeMode
    ? findings.filter((finding) => finding.safetyLevel !== 'sensitive')
    : findings;
  const safeModeSkipped = safeMode
    ? findings.filter((finding) => finding.safetyLevel === 'sensitive')
    : [];

  const client = createWordPressClient({
    siteUrl: site.siteUrl,
    tokenHash,
    timeout: 10000,
  });

  const [capabilitiesResponse, pull] = await Promise.all([
    client.getCapabilities(),
    client.pull(),
  ]);

  const capabilities = normalizeCapabilities(capabilitiesResponse.capabilities ?? {});
  const plan = createWordPressActionPlan({
    siteId,
    source: 'system',
    objective: `Remediate ${allowedFindings.length} selected WordPress finding(s) with low-risk auto-apply where supported.`,
    findings: allowedFindings,
    snapshot: {
      builder: inferBuilderFromPull(pull),
    },
    capabilities,
  });

  const actionResults = await executeWordPressActionPlan({
    siteUrl: site.siteUrl,
    tokenHash,
    plan,
  });

  const skippedBySafeModeResults: PersistedExecutionResult[] = safeModeSkipped.map((finding) => ({
    findingId: finding.id,
    actionId: finding.actionId ?? finding.id,
    title: finding.title ?? finding.id,
    status: 'skipped',
    applied: false,
    autoApplied: false,
    message: `Skipped ${finding.title ?? finding.id} because safe mode blocks sensitive changes.`,
    skippedBySafeMode: true,
    requiresApproval: true,
  }));

  const executionResults: PersistedExecutionResult[] = [
    ...actionResults.map((result): PersistedExecutionResult => {
      const persistedStatus: PersistedExecutionResult['status'] =
        result.status === 'applied' || result.status === 'failed' ? result.status : 'skipped';

      return {
        findingId:
          (plan.actions.find((action) => action.id === result.actionId)?.payload.sourceFindingId as string | undefined) ??
          result.actionId,
        actionId: result.actionId,
        title: result.title,
        status: persistedStatus,
        applied: result.applied,
        autoApplied: result.autoApplied,
        message: result.message,
        skippedBySafeMode: false,
        requiresApproval: result.requiresApproval,
        verification: result.verification,
        connectorResult: result.connectorResult,
        rollback: result.rollback,
      };
    }),
    ...skippedBySafeModeResults,
  ];

  let changeSetId: string | undefined;
  let analysisJobId: string | undefined;
  let auditLogged = false;
  let auditError: string | undefined;
  let aiTrackingError: string | undefined;

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
        repairableIssues: executionResults.filter((result) => result.status === 'applied').length,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning({ id: aiAnalysisJobs.id });

    analysisJobId = analysisJob?.id;

    if (analysisJobId) {
      const repairActionValues = executionResults.map((result) => {
        const persistedStatus: 'completed' | 'failed' | 'skipped' =
          result.status === 'applied'
            ? 'completed'
            : result.status === 'failed'
              ? 'failed'
              : 'skipped';

        return {
          analysisJobId,
          siteId,
          issueId: result.findingId,
          actionId: result.actionId,
          title: result.title,
          category: 'wordpress',
          severity: findings.find((finding) => finding.id === result.findingId)?.severity,
          status: persistedStatus,
          repairMethod: result.autoApplied ? 'connector-action-gateway' : 'manual-review',
          changes: {
            safeMode,
            locale,
            planActionId: result.actionId,
            applied: result.applied,
            requiresApproval: result.requiresApproval,
          },
          executedAt: new Date(),
          safeModeSkipped: result.skippedBySafeMode,
          reportIncluded: true,
        };
      });

      await db.insert(aiRepairActions).values(repairActionValues);
    }
  } catch (error: any) {
    aiTrackingError = String(error?.message ?? error ?? 'Unknown AI tracking error');
    console.warn('[wordpress/remediate] ai tracking skipped:', aiTrackingError);
  }

  try {
    const [changeSet] = await db
      .insert(changeSets)
      .values({
        siteId,
        title: 'WordPress Typed Remediation',
        description: `Processed ${executionResults.length} WordPress remediation action(s) through the mutation planner/runner.`,
        status: executionResults.some((result) => result.status === 'failed') ? 'failed' : 'applied',
        createdByUserId: dbUser.id,
      })
      .returning({ id: changeSets.id });

    changeSetId = changeSet?.id;

    if (changeSetId) {
      const persistedChangeSetId = changeSetId;
      const changeItemValues = executionResults.map((result) => ({
        changeSetId: persistedChangeSetId,
          op: 'remediate',
          path: `wordpress/${result.actionId}`,
          oldValue: { status: 'planned' },
          newValue: {
            status: result.status,
            applied: result.applied,
            requiresApproval: result.requiresApproval,
            verification: result.verification ?? null,
          },
      }));
      await db.insert(changeItems).values(changeItemValues);
      auditLogged = true;
    }
  } catch (error: any) {
    auditError = String(error?.message ?? error ?? 'Unknown remediation backend error');
    console.warn('[wordpress/remediate] backend audit skipped:', auditError);
  }

  for (const result of executionResults) {
    publishEvent(siteId, {
      type: 'repair',
      state: result.status === 'failed' ? 'repairing' : 'repairing',
      message: result.message,
      platform: 'wordpress',
    });
  }

  publishEvent(siteId, {
    type: 'repair',
    state: 'repaired',
    message: `${executionResults.filter((result) => result.applied).length} WordPress action(s) applied, ${executionResults.filter((result) => result.status === 'skipped').length} deferred.`,
    platform: 'wordpress',
  });

  return NextResponse.json({
    success: true,
    siteId,
    safeMode,
    locale,
    plan,
    capabilities: capabilities.raw,
    analysisJobId,
    changeSetId,
    auditLogged,
    ...(auditError ? { auditError } : {}),
    ...(aiTrackingError ? { aiTrackingError } : {}),
    summary: {
      requested: findings.length,
      autoApplied: executionResults.filter((result) => result.applied).length,
      deferred: executionResults.filter((result) => result.status === 'skipped').length,
      failed: executionResults.filter((result) => result.status === 'failed').length,
    },
    executed: executionResults,
  });
}
