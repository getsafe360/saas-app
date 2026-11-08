// lib/wordpress/remediation-result.ts
//
// The per-item outcome of a "Fix" run, as the checklist shows it. One item per
// planned action; an action can cover several findings (four missing security
// headers are one connector request), so items carry every finding they cover.

import type { WordPressActionPlan } from '@/lib/wordpress/types';

export type RemediationItemStatus = 'applied' | 'failed' | 'skipped';

export type RemediationItemReason =
  /** Applied and confirmed on the live site. */
  | 'verified'
  /** Applied, but the live check did not see it yet (e.g. a CDN cache). Still undoable. */
  | 'verification_failed'
  /** The connector refused or failed the change; nothing was modified. */
  | 'connector_failed'
  /** The installed connector is too old for this fix. */
  | 'connector_update'
  /** Sensitive change held back by Safe Mode. */
  | 'safe_mode'
  /** No automatic fix exists; follow the guided steps. */
  | 'not_automatic'
  /** Unexpected error while running the fix. */
  | 'error';

export interface RemediationItem {
  actionId: string;
  findingIds: string[];
  /** Action run id, needed for Undo; null when the run was not recorded. */
  runId: string | null;
  status: RemediationItemStatus;
  reason: RemediationItemReason;
  /** Technical detail from the connector or verifier (English). */
  message: string;
  undoable: boolean;
}

export interface ExecutionResultLike {
  findingId: string;
  actionId: string;
  status: RemediationItemStatus;
  autoApplied: boolean;
  message: string;
  skippedBySafeMode: boolean;
  verification?: { success: boolean } | null;
  connectorResult?: unknown;
  rollback?: unknown;
}

function reasonFor(result: ExecutionResultLike, missingCapabilities: number): RemediationItemReason {
  if (result.status === 'applied') return 'verified';
  if (result.status === 'failed') {
    if (result.verification && !result.verification.success) return 'verification_failed';
    return result.connectorResult ? 'connector_failed' : 'error';
  }
  if (result.skippedBySafeMode) return 'safe_mode';
  if (missingCapabilities > 0) return 'connector_update';
  if (result.connectorResult) return 'connector_failed';
  return 'not_automatic';
}

export function toRemediationItems(
  results: ReadonlyArray<ExecutionResultLike>,
  plan: Pick<WordPressActionPlan, 'actions'>,
  runIdByActionId: ReadonlyMap<string, string>,
): RemediationItem[] {
  const actionsById = new Map(plan.actions.map((action) => [action.id, action]));
  return results.map((result) => {
    const payload = (actionsById.get(result.actionId)?.payload ?? {}) as Record<string, unknown>;
    const covered = Array.isArray(payload.sourceFindingIds)
      ? (payload.sourceFindingIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];
    const missing = Array.isArray(payload.missingCapabilities) ? payload.missingCapabilities.length : 0;
    const runId = runIdByActionId.get(result.actionId) ?? null;
    const reason = reasonFor(result, missing);
    return {
      actionId: result.actionId,
      findingIds: covered.length > 0 ? covered : [result.findingId],
      runId,
      status: result.status,
      reason,
      message: result.message,
      // The connector only returns an inverse when it changed the site.
      undoable:
        runId !== null &&
        (result.status === 'applied' || reason === 'verification_failed') &&
        result.rollback !== null &&
        result.rollback !== undefined,
    };
  });
}
