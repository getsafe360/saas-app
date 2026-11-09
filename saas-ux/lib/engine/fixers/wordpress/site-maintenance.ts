// lib/engine/fixers/wordpress/site-maintenance.ts
//
// Connector 1.7 fixers that change WordPress itself: default role, wp-config.php
// permissions, plugin auto-updates and database cleanup. Each sends a fixed,
// allowlisted request (never values taken from the client) and verifies the
// result through the site audit.

import {
  EXPIRED_TRANSIENTS_LIMIT,
  REVISIONS_LIMIT,
} from '@/lib/engine/wordpress/audit-rules';
import type { WordPressConnectorActionRequest } from '@/lib/wordpress/types';
import { type ConnectorFixer, type FixerActionTemplate, verificationResult } from '../types';
import { type AuditExpectation, auditChecks } from './audit-check';

type Request = WordPressConnectorActionRequest;

interface MaintenanceFixerSpec {
  id: string;
  template: Omit<FixerActionTemplate, 'payload' | 'requiredCapabilities' | 'type'> & {
    type: Request['type'];
    capability: string;
  };
  request: (actionId: string) => Request;
  expectations: ReadonlyArray<AuditExpectation>;
}

function maintenanceFixer(spec: MaintenanceFixerSpec): ConnectorFixer {
  const { capability, ...template } = spec.template;
  return {
    id: spec.id,
    executor: 'wp-connector',
    plan: (findings) =>
      findings.length === 0
        ? null
        : {
            ...template,
            requiredCapabilities: [capability],
            payload: { request: spec.request('planned').payload },
          },
    toConnectorRequest: (action) => spec.request(action.id),
    verify: async (context) => verificationResult(await auditChecks(context, spec.expectations)),
  };
}

export const defaultRoleFixer = maintenanceFixer({
  id: 'wordpress-fix-default-role',
  template: {
    type: 'set_default_role',
    title: 'Give new accounts the Subscriber role',
    description:
      'New registrations currently become administrators. This sets the default role to Subscriber. It cannot be undone from here, because restoring an administrator default would reopen the hole.',
    risk: 'low',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'securityDefaultRole',
    verification: {
      kind: 'api',
      expectation: 'New registrations no longer receive the administrator role.',
      assertions: ['Site audit reports defaultRoleIsAdmin = false'],
    },
  },
  request: (id) => ({ id, type: 'set_default_role', payload: { role: 'subscriber' } }),
  expectations: [
    {
      name: 'audit:default-role',
      test: (audit) => !audit.security.defaultRoleIsAdmin,
      ok: 'New accounts get a role without administrative rights.',
      failed: 'New accounts still become administrators.',
    },
  ],
});

export const configPermissionsFixer = maintenanceFixer({
  id: 'wordpress-tighten-config-permissions',
  template: {
    type: 'set_config_permissions',
    title: 'Make wp-config.php private',
    description:
      'Removes read access for other accounts on the server (for example 644 → 640). The connector only does this when PHP itself keeps access, and the previous permissions are restored on undo.',
    risk: 'low',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'securityConfigPermissions',
    verification: {
      kind: 'api',
      expectation: 'wp-config.php is no longer world-readable.',
      assertions: ['Site audit reports wpConfigWorldReadable = false'],
    },
  },
  request: (id) => ({ id, type: 'set_config_permissions', payload: { mode: 'tighten' } }),
  expectations: [
    {
      name: 'audit:wp-config-private',
      test: (audit) => (audit.security.wpConfigWorldReadable === null ? null : !audit.security.wpConfigWorldReadable),
      ok: 'wp-config.php is no longer readable by other accounts.',
      failed: 'wp-config.php is still world-readable.',
    },
  ],
});

export const pluginAutoUpdatesFixer = maintenanceFixer({
  id: 'wordpress-enable-plugin-auto-updates',
  template: {
    type: 'set_plugin_auto_updates',
    title: 'Turn on plugin auto-updates',
    description:
      'Switches on WordPress’s own automatic updates for every installed plugin, the same switch as on the Plugins screen. Updates can occasionally break a site; undo restores the previous list.',
    risk: 'medium',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'autoUpdatesPlugins',
    verification: {
      kind: 'api',
      expectation: 'Every installed plugin has automatic updates switched on.',
      assertions: ['Site audit reports pluginsEnabled = pluginsTotal'],
    },
  },
  request: (id) => ({ id, type: 'set_plugin_auto_updates', payload: { enable: 'all' } }),
  expectations: [
    {
      name: 'audit:plugin-auto-updates',
      test: (audit) => (audit.autoUpdates ? audit.autoUpdates.pluginsEnabled >= audit.autoUpdates.pluginsTotal : null),
      ok: 'Every plugin now updates automatically.',
      failed: 'Some plugins still do not update automatically.',
    },
  ],
});

export const cleanTransientsFixer = maintenanceFixer({
  id: 'wordpress-clean-transients',
  template: {
    type: 'cleanup_database',
    title: 'Remove expired transients',
    description: 'Deletes cached values that have already expired. WordPress recreates anything it still needs.',
    risk: 'low',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'databaseCleanup',
    verification: {
      kind: 'api',
      expectation: 'Expired transients are back under the limit.',
      assertions: [`Site audit reports at most ${EXPIRED_TRANSIENTS_LIMIT} expired transients`],
    },
  },
  request: (id) => ({ id, type: 'cleanup_database', payload: { task: 'expired_transients' } }),
  expectations: [
    {
      name: 'audit:expired-transients',
      test: (audit) =>
        audit.database.expiredTransients === null ? null : audit.database.expiredTransients <= EXPIRED_TRANSIENTS_LIMIT,
      ok: 'Expired transients were removed.',
      failed: 'Many expired transients are still stored.',
    },
  ],
});

export const revisionsFixer = maintenanceFixer({
  id: 'wordpress-limit-revisions',
  template: {
    type: 'cleanup_database',
    title: 'Remove old post revisions',
    description:
      'Keeps the newest 5 revisions of every post and page and deletes older ones. Deleted revisions cannot be restored.',
    risk: 'medium',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'databaseCleanup',
    verification: {
      kind: 'api',
      expectation: 'Only the newest 5 revisions per post remain.',
      assertions: ['Site audit reports revisionsRemovable = 0'],
    },
  },
  request: (id) => ({ id, type: 'cleanup_database', payload: { task: 'revisions' } }),
  expectations: [
    {
      name: 'audit:old-revisions',
      test: (audit) => {
        const removable = audit.database.revisionsRemovable;
        if (typeof removable === 'number') return removable === 0;
        return audit.database.revisions === null ? null : audit.database.revisions <= REVISIONS_LIMIT;
      },
      ok: 'Old revisions were removed.',
      failed: 'Old revisions remain; very large sites may need the cleanup to run again.',
    },
  ],
});
