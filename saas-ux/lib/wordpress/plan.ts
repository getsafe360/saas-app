import type {
  WordPressActionPlan,
  WordPressActionRisk,
  WordPressCapabilitySummary,
  WordPressPlannedAction,
  WordPressSiteSnapshot,
} from '@/lib/wordpress/types';

export interface RemediationFindingInput {
  id: string;
  actionId?: string;
  title?: string;
  severity?: string;
  category?: string;
  automationLevel?: string;
  safetyLevel?: 'safe' | 'review' | 'sensitive';
}

interface ActionTemplate {
  type: WordPressPlannedAction['type'];
  title: string;
  description: string;
  risk: WordPressActionRisk;
  autoApplyEligible: boolean;
  requiresApproval: boolean;
  requiredCapabilities: string[];
  verification: NonNullable<WordPressPlannedAction['verification']>;
  payload: Record<string, unknown>;
}

const CAPABILITY_LABELS: Record<string, string> = {
  securityDisableXmlrpc: 'disable XML-RPC from the connector',
  securityBlockUserEnumeration: 'block user enumeration from the connector',
};

function makeActionId(finding: RemediationFindingInput): string {
  return finding.actionId?.trim() || finding.id.trim();
}

function inferRisk(finding: RemediationFindingInput): WordPressActionRisk {
  if (finding.safetyLevel === 'sensitive') return 'high';
  if (finding.safetyLevel === 'review') return 'medium';
  return 'low';
}

function buildFallbackAction(finding: RemediationFindingInput): WordPressPlannedAction {
  const risk = inferRisk(finding);
  return {
    id: makeActionId(finding),
    type: 'verify_render',
    title: finding.title?.trim() || 'Review WordPress finding',
    description:
      'This finding has been captured for guided review, but the connected plugin does not yet expose a deterministic auto-apply action for it.',
    risk,
    autoApplyEligible: false,
    requiresApproval: true,
    requiredCapabilities: [],
    verification: {
      kind: 'api',
      expectation: 'Confirm the issue manually or after a future connector capability upgrade.',
      assertions: ['Manual review required'],
    },
    payload: {
      sourceFindingId: finding.id,
      sourceActionId: finding.actionId ?? finding.id,
      reason: 'unsupported_by_connector',
      suggestedAutomationLevel: finding.automationLevel ?? 'manual',
    },
  };
}

function actionTemplateForFinding(finding: RemediationFindingInput): ActionTemplate | null {
  const actionId = makeActionId(finding);

  switch (actionId) {
    case 'wordpress-block-user-enumeration':
      return {
        type: 'update_connector_setting',
        title: 'Block public user enumeration',
        description:
          'Enable the connector guard that blocks REST user list exposure and the common ?author=ID enumeration path.',
        risk: 'low',
        autoApplyEligible: true,
        requiresApproval: false,
        requiredCapabilities: ['securityBlockUserEnumeration'],
        verification: {
          kind: 'mixed',
          expectation: 'The connector reports user enumeration protection as enabled and public user endpoints stop exposing users.',
          assertions: [
            'Connector protection state reports blockUserEnumeration = true',
            'Public /wp-json/wp/v2/users no longer returns a user list',
            'Public ?author=1 probing is blocked or does not resolve to an author archive',
          ],
        },
        payload: {
          setting: {
            key: 'blockUserEnumeration',
            enabled: true,
          },
        },
      };

    case 'wordpress-disable-xmlrpc':
      return {
        type: 'update_connector_setting',
        title: 'Disable XML-RPC',
        description:
          'Enable the connector guard that disables XML-RPC at the WordPress layer unless the site explicitly needs it.',
        risk: 'low',
        autoApplyEligible: true,
        requiresApproval: false,
        requiredCapabilities: ['securityDisableXmlrpc'],
        verification: {
          kind: 'api',
          expectation: 'The connector reports XML-RPC protection as enabled after the change.',
          assertions: [
            'Connector protection state reports disableXmlRpc = true',
          ],
        },
        payload: {
          setting: {
            key: 'disableXmlRpc',
            enabled: true,
          },
        },
      };

    default:
      return null;
  }
}

function buildAction(
  finding: RemediationFindingInput,
  capabilities: WordPressCapabilitySummary
): WordPressPlannedAction {
  const template = actionTemplateForFinding(finding);
  if (!template) {
    return buildFallbackAction(finding);
  }

  const missingCapabilities = template.requiredCapabilities.filter(
    (capability) => !capabilities.raw?.[capability]
  );

  const autoApplyEligible = template.autoApplyEligible && missingCapabilities.length === 0;
  const requiresApproval = template.requiresApproval || missingCapabilities.length > 0;

  const capabilityNote = missingCapabilities.length > 0
    ? ` Missing connector capabilities: ${missingCapabilities
        .map((capability) => CAPABILITY_LABELS[capability] ?? capability)
        .join(', ')}.`
    : '';

  return {
    id: makeActionId(finding),
    type: template.type,
    title: template.title,
    description: `${template.description}${capabilityNote}`,
    risk: missingCapabilities.length > 0 ? 'medium' : template.risk,
    autoApplyEligible,
    requiresApproval,
    requiredCapabilities: template.requiredCapabilities,
    verification: template.verification,
    payload: {
      ...template.payload,
      sourceFindingId: finding.id,
      sourceActionId: finding.actionId ?? finding.id,
      sourceTitle: finding.title ?? template.title,
      missingCapabilities,
    },
  };
}

export function createWordPressActionPlan(params: {
  siteId: string;
  source?: WordPressActionPlan['source'];
  objective?: string;
  findings: RemediationFindingInput[];
  snapshot?: Pick<WordPressSiteSnapshot, 'builder'> | null;
  capabilities: WordPressCapabilitySummary;
}): WordPressActionPlan {
  const actions = params.findings.map((finding) => buildAction(finding, params.capabilities));

  return {
    siteId: params.siteId,
    source: params.source ?? 'system',
    objective:
      params.objective ??
      `Address ${params.findings.length} selected WordPress finding(s) with typed, rollback-aware actions.`,
    builder: params.snapshot?.builder ?? 'unknown',
    actions,
  };
}
