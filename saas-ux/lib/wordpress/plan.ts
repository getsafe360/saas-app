import { getFixer } from '@/lib/engine/fixers/registry';
import type { FixerActionTemplate } from '@/lib/engine/fixers/types';
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

const CAPABILITY_LABELS: Record<string, string> = {
  securityDisableXmlrpc: 'disable XML-RPC from the connector',
  securityBlockUserEnumeration: 'block user enumeration from the connector',
  securityHeaders: 'send security headers (connector 1.5 or newer)',
  securityDisableFileEditor: 'lock the file editor (connector 1.7 or newer)',
  securityDefaultRole: 'change the default role (connector 1.7 or newer)',
  securityConfigPermissions: 'change wp-config.php permissions (connector 1.7 or newer)',
  autoUpdatesCore: 'switch on security updates (connector 1.7 or newer)',
  autoUpdatesPlugins: 'switch on plugin auto-updates (connector 1.7 or newer)',
  databaseCleanup: 'clean up the database (connector 1.7 or newer)',
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

function buildAction(
  actionId: string,
  findings: RemediationFindingInput[],
  template: FixerActionTemplate,
  capabilities: WordPressCapabilitySummary
): WordPressPlannedAction {
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

  const [first] = findings;
  return {
    id: actionId,
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
      fixerId: actionId,
      sourceFindingId: first.id,
      sourceFindingIds: findings.map((finding) => finding.id),
      sourceActionId: first.actionId ?? first.id,
      sourceTitle: first.title ?? template.title,
      missingCapabilities,
    },
  };
}

/**
 * Group selected findings by fixer: one fixer → one action, even when several
 * findings share it (e.g. four missing security headers). Findings without a
 * registered fixer each become a guided-review action.
 */
function planActions(
  findings: RemediationFindingInput[],
  capabilities: WordPressCapabilitySummary
): WordPressPlannedAction[] {
  const groups = new Map<string, RemediationFindingInput[]>();
  for (const finding of findings) {
    const actionId = makeActionId(finding);
    groups.set(actionId, [...(groups.get(actionId) ?? []), finding]);
  }

  const actions: WordPressPlannedAction[] = [];
  for (const [actionId, group] of groups) {
    const template = getFixer(actionId)?.plan(group) ?? null;
    if (template) {
      actions.push(buildAction(actionId, group, template, capabilities));
    } else {
      actions.push(...group.map(buildFallbackAction));
    }
  }
  return actions;
}

export function createWordPressActionPlan(params: {
  siteId: string;
  source?: WordPressActionPlan['source'];
  objective?: string;
  findings: RemediationFindingInput[];
  snapshot?: Pick<WordPressSiteSnapshot, 'builder'> | null;
  capabilities: WordPressCapabilitySummary;
}): WordPressActionPlan {
  const actions = planActions(params.findings, params.capabilities);

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
