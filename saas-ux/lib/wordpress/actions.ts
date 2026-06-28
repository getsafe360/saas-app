import { createWordPressClient } from '@/lib/wordpress/client';
import type {
  WordPressActionExecutionResult,
  WordPressActionPlan,
  WordPressConnectorActionRequest,
  WordPressPlannedAction,
} from '@/lib/wordpress/types';
import { verifyWordPressAction } from '@/lib/wordpress/verify';

function toConnectorRequest(action: WordPressPlannedAction): WordPressConnectorActionRequest | null {
  if (action.type !== 'update_connector_setting') {
    return null;
  }

  const setting = action.payload.setting as WordPressConnectorActionRequest['payload'] | undefined;
  if (!setting?.key) {
    return null;
  }

  return {
    id: action.id,
    type: 'update_connector_setting',
    payload: {
      key: setting.key,
      enabled: setting.enabled !== false,
    },
  };
}

function buildSkippedResult(
  action: WordPressPlannedAction,
  message: string,
  requiresApproval = action.requiresApproval
): WordPressActionExecutionResult {
  return {
    actionId: action.id,
    type: action.type,
    title: action.title,
    status: 'skipped',
    applied: false,
    autoApplied: false,
    message,
    requiresApproval,
  };
}

export async function executeWordPressActionPlan(params: {
  siteUrl: string;
  tokenHash: string;
  plan: WordPressActionPlan;
}): Promise<WordPressActionExecutionResult[]> {
  const client = createWordPressClient({
    siteUrl: params.siteUrl,
    tokenHash: params.tokenHash,
    timeout: 10000,
  });

  const results: WordPressActionExecutionResult[] = [];

  for (const action of params.plan.actions) {
    if (!action.autoApplyEligible) {
      const reason = action.requiresApproval
        ? 'Queued for review because this action requires approval or additional connector capabilities.'
        : 'This action is not eligible for automatic application yet.';
      results.push(buildSkippedResult(action, reason));
      continue;
    }

    const request = toConnectorRequest(action);
    if (!request) {
      results.push(buildSkippedResult(action, 'No connector request could be derived for this action.'));
      continue;
    }

    try {
      const connectorResponse = await client.applyActions([request]);
      const connectorResult = connectorResponse.results.find((item) => item.id === action.id) ?? null;

      if (!connectorResponse.success || !connectorResult || connectorResult.status !== 'applied') {
        results.push({
          actionId: action.id,
          type: action.type,
          title: action.title,
          status: connectorResult?.status === 'failed' ? 'failed' : 'skipped',
          applied: false,
          autoApplied: false,
          message: connectorResult?.message ?? 'Connector did not apply the action.',
          requiresApproval: action.requiresApproval,
          connectorResult,
          rollback: connectorResult?.rollback ?? null,
        });
        continue;
      }

      const verification = await verifyWordPressAction({
        siteUrl: params.siteUrl,
        tokenHash: params.tokenHash,
        action,
      });

      results.push({
        actionId: action.id,
        type: action.type,
        title: action.title,
        status: verification.success ? 'applied' : 'failed',
        applied: verification.success,
        autoApplied: true,
        message: verification.success
          ? connectorResult.message
          : verification.message ?? 'Action failed verification.',
        requiresApproval: false,
        verification,
        connectorResult,
        rollback: connectorResult.rollback ?? null,
      });
    } catch (error) {
      results.push({
        actionId: action.id,
        type: action.type,
        title: action.title,
        status: 'failed',
        applied: false,
        autoApplied: true,
        message: error instanceof Error ? error.message : 'Unknown action execution error.',
        requiresApproval: action.requiresApproval,
      });
    }
  }

  return results;
}
