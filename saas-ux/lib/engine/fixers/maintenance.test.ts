import assert from 'node:assert/strict';
import test from 'node:test';

import audit16 from '../wordpress/__fixtures__/audit-wp-7.1.4.json';
import audit17 from '../wordpress/__fixtures__/audit-wp-7.1.4-plugin-1.7.json';
import { evaluateWordPressHealthFromApiData } from '../wordpress/view';
import { evaluateRules } from '../rules';
import { WORDPRESS_AUDIT_RULES } from '../wordpress/audit-rules';
import { buildWordPressFacts } from '../wordpress/facts';
import { fixModeFor } from './catalog';
import { getFixer } from './registry';
import { createWordPressActionPlan } from '@/lib/wordpress/plan';
import { parseRollbackRequest } from '@/lib/wordpress/rollback';
import type { WordPressCapabilitySummary } from '@/lib/wordpress/types';
import { connectorTimeoutFor } from '@/lib/wordpress/timeouts';

// Real response from connector 1.7.0 on WordPress 7.1.4: security releases
// on, no plugin auto-updates (0 of 2), file editor open, no revisions.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function apiData(audit: unknown) {
  return {
    connectionStatus: { isConnected: true },
    isHttps: true,
    cms: { type: 'wordpress', wp: { version: '7.1.4' } },
    wordpressTelemetry: { snapshot: { inspectedAt: '2026-11-09T00:00:00Z', audit } },
  };
}

const findings = (audit: unknown) =>
  new Map(evaluateWordPressHealthFromApiData(apiData(audit)).findings.map((finding) => [finding.id, finding]));

const capabilities = (raw: Record<string, boolean>): WordPressCapabilitySummary => ({
  read: true,
  write: true,
  themeFiles: false,
  mediaUpload: false,
  pageUpdate: false,
  rollback: true,
  raw,
});

const CAPS_17 = capabilities({
  securityDisableFileEditor: true,
  securityDefaultRole: true,
  securityConfigPermissions: true,
  autoUpdatesCore: true,
  autoUpdatesPlugins: true,
  databaseCleanup: true,
});

test('real 1.7 audit: security releases on, plugin auto-updates off', () => {
  const byId = findings(audit17);
  assert.equal(byId.get('wp-core-auto-updates')?.status, 'pass');
  const plugins = byId.get('wp-plugin-auto-updates');
  assert.equal(plugins?.status, 'warn');
  assert.equal(plugins?.summary, 'None of the 2 plugins update automatically.');
  // Plugin updates can break a site: offered, never ticked in advance.
  assert.equal(plugins?.selectedByDefault, false);
  assert.equal(fixModeFor(plugins?.fix?.fixerId, plugins?.fix?.automation), 'automatic');
});

test('older connectors leave the auto-update checks unknown', () => {
  const byId = findings(audit16);
  for (const id of ['wp-core-auto-updates', 'wp-plugin-auto-updates']) {
    assert.equal(byId.get(id)?.status, 'unknown', id);
    assert.equal(byId.get(id)?.summary, 'Needs the GetSafe 360 plugin 1.7 or newer.');
  }
});

test('security releases off: high, fixed automatically and ticked in advance', () => {
  const audit = clone(audit17);
  audit.autoUpdates.coreMinor = false;
  const finding = findings(audit).get('wp-core-auto-updates');
  assert.equal(finding?.status, 'fail');
  assert.equal(finding?.severity, 'high');
  assert.equal(finding?.selectedByDefault, true);
  assert.equal(fixModeFor(finding?.fix?.fixerId, finding?.fix?.automation), 'automatic');
});

test('updater switched off in wp-config: manual, no fix offered', () => {
  const audit = clone(audit17);
  audit.autoUpdates = { ...audit.autoUpdates, updaterDisabled: true, coreMinor: false, pluginsAllowed: false };
  const byId = findings(audit);
  for (const id of ['wp-core-auto-updates', 'wp-plugin-auto-updates']) {
    const finding = byId.get(id);
    assert.equal(finding?.status, 'warn', id);
    assert.equal(finding?.fix?.fixerId, undefined, `${id} has no fixer`);
    assert.equal(fixModeFor(finding?.fix?.fixerId, finding?.fix?.automation), 'manual');
    assert.equal(finding?.selectedByDefault, false);
  }
});

test('new connector fixes: automatic, and only reversible low-risk ones are ticked in advance', () => {
  const audit = clone(audit17);
  audit.security.usersCanRegister = true;
  audit.security.defaultRoleIsAdmin = true;
  const byId = findings(audit);

  const role = byId.get('wp-open-admin-registration');
  assert.equal(role?.severity, 'critical');
  assert.equal(fixModeFor(role?.fix?.fixerId, role?.fix?.automation), 'automatic');
  // Cannot be undone (the connector never restores an admin default), so it needs a tick.
  assert.equal(role?.selectedByDefault, false);

  for (const id of ['wp-file-editing', 'wp-config-permissions']) {
    const finding = byId.get(id);
    assert.equal(fixModeFor(finding?.fix?.fixerId, finding?.fix?.automation), 'automatic', id);
  }
});

test('revisions: no warning once only the newest per post remain', () => {
  const rules = WORDPRESS_AUDIT_RULES.filter((rule) => rule.id === 'wp-revisions');
  const facts = (revisions: number, revisionsRemovable: number | null) => {
    const audit = clone(audit17);
    audit.database.revisions = revisions;
    (audit.database as Record<string, unknown>).revisionsRemovable = revisionsRemovable;
    return buildWordPressFacts(apiData(audit));
  };
  assert.equal(evaluateRules(rules, facts(9000, 4000))[0].status, 'warn');
  assert.equal(evaluateRules(rules, facts(9000, 0))[0].status, 'pass');
  assert.equal(evaluateRules(rules, facts(9000, null))[0].status, 'warn', 'older connectors keep the count-only check');
});

test('planner sends fixed, allowlisted requests', () => {
  const plan = createWordPressActionPlan({
    siteId: 's1',
    capabilities: CAPS_17,
    findings: [
      { id: 'wp-file-editing', actionId: 'wordpress-disable-file-edit' },
      { id: 'wp-core-auto-updates', actionId: 'wordpress-enable-core-auto-updates' },
      { id: 'wp-open-admin-registration', actionId: 'wordpress-fix-default-role' },
      { id: 'wp-config-permissions', actionId: 'wordpress-tighten-config-permissions' },
      { id: 'wp-plugin-auto-updates', actionId: 'wordpress-enable-plugin-auto-updates' },
      { id: 'wp-expired-transients', actionId: 'wordpress-clean-transients' },
      { id: 'wp-revisions', actionId: 'wordpress-limit-revisions' },
    ],
  });
  assert.equal(plan.actions.length, 7);
  assert.ok(plan.actions.every((action) => action.autoApplyEligible && !action.requiresApproval));

  const requests = Object.fromEntries(
    plan.actions.map((action) => [action.id, getFixer(action.id)!.toConnectorRequest(action)]),
  );
  assert.deepEqual(requests['wordpress-disable-file-edit'], {
    id: 'wordpress-disable-file-edit',
    type: 'update_connector_setting',
    payload: { key: 'disableFileEditor', enabled: true },
  });
  assert.deepEqual(requests['wordpress-enable-core-auto-updates']?.payload, { key: 'enableCoreSecurityUpdates', enabled: true });
  assert.deepEqual(requests['wordpress-fix-default-role']?.payload, { role: 'subscriber' });
  assert.deepEqual(requests['wordpress-tighten-config-permissions']?.payload, { mode: 'tighten' });
  assert.deepEqual(requests['wordpress-enable-plugin-auto-updates']?.payload, { enable: 'all' });
  assert.deepEqual(requests['wordpress-clean-transients']?.payload, { task: 'expired_transients' });
  assert.deepEqual(requests['wordpress-limit-revisions']?.payload, { task: 'revisions' });

  // A tampered planned payload cannot change what is sent.
  const role = plan.actions.find((action) => action.id === 'wordpress-fix-default-role')!;
  const tampered = { ...role, payload: { ...role.payload, request: { role: 'administrator' } } };
  assert.deepEqual(getFixer(role.id)!.toConnectorRequest(tampered)?.payload, { role: 'subscriber' });
});

test('connector 1.6 sites get the fixes queued with an update hint, not applied', () => {
  const plan = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ siteAudit: true, securityHeaders: true }),
    findings: [{ id: 'wp-file-editing', actionId: 'wordpress-disable-file-edit' }],
  });
  const [action] = plan.actions;
  assert.equal(action.autoApplyEligible, false);
  assert.equal(action.requiresApproval, true);
  assert.match(action.description, /connector 1\.7 or newer/);
});

test('rollback accepts the new inverse shapes and nothing dangerous', () => {
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_config_permissions', payload: { mode: '0644' } })?.payload, {
    mode: '0644',
  });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_config_permissions', payload: { mode: '0666' } }), null);
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_config_permissions', payload: { mode: 'tighten; rm' } }), null);

  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_default_role', payload: { role: 'author' } })?.payload, {
    role: 'author',
  });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_default_role', payload: { role: "admin'--" } }), null);

  const plugins = { plugins: ['akismet/akismet.php', 'hello.php'], replace: true };
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_plugin_auto_updates', payload: plugins })?.payload, plugins);
  assert.equal(
    parseRollbackRequest({ id: 'r', type: 'set_plugin_auto_updates', payload: { plugins: ['../wp-config.php'], replace: true } }),
    null,
  );
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_plugin_auto_updates', payload: { enable: 'all' } }), null);

  assert.equal(parseRollbackRequest({ id: 'r', type: 'cleanup_database', payload: { task: 'revisions' } }), null);
  assert.deepEqual(
    parseRollbackRequest({ id: 'r', type: 'update_connector_setting', payload: { key: 'disableFileEditor', enabled: false } })
      ?.payload,
    { key: 'disableFileEditor', enabled: false },
  );
});

test('verification reads the site audit after the change', async () => {
  const original = globalThis.fetch;
  const respond = (body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const fixer = getFixer('wordpress-enable-plugin-auto-updates')!;
  const action = createWordPressActionPlan({
    siteId: 's1',
    capabilities: CAPS_17,
    findings: [{ id: 'wp-plugin-auto-updates', actionId: fixer.id }],
  }).actions[0];

  try {
    globalThis.fetch = respond(audit17);
    const before = await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action });
    assert.equal(before.success, false);

    const after = clone(audit17);
    after.autoUpdates.pluginsEnabled = 2;
    globalThis.fetch = respond(after);
    assert.equal((await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action })).success, true);

    globalThis.fetch = respond({ schema: 2 });
    const malformed = await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action });
    assert.equal(malformed.success, false);
    assert.match(malformed.checks[0].detail ?? '', /did not return a site audit/);
  } finally {
    globalThis.fetch = original;
  }
});

test('outdated plugins: automatic with a restore point, manual when the host blocks updates', () => {
  const audit: any = clone(audit17);
  audit.plugins.updatesAvailable = 3;
  const finding = findings(audit).get('wp-outdated-plugins');
  assert.equal(finding?.status, 'fail');
  assert.equal(fixModeFor(finding?.fix?.fixerId, finding?.fix?.automation), 'automatic');
  assert.equal(finding?.selectedByDefault, false, 'updates are never ticked in advance');

  const blocked: any = clone(audit17);
  blocked.plugins.updatesAvailable = 3;
  blocked.plugins.updatesPossible = false;
  const manual = findings(blocked).get('wp-outdated-plugins');
  assert.equal(manual?.fix, undefined);
  assert.equal(fixModeFor(undefined, undefined), 'manual');
});

test('plugin updates: fixed request, long timeout, restore-point undo', () => {
  const plan = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ pluginUpdates: true }),
    findings: [{ id: 'wp-outdated-plugins', actionId: 'wordpress-update-plugins' }],
  });
  const [action] = plan.actions;
  assert.equal(action.autoApplyEligible, true);
  assert.equal(action.risk, 'medium');
  assert.match(action.description, /database tables are not undone/);
  assert.deepEqual(getFixer(action.id)!.toConnectorRequest(action), {
    id: 'wordpress-update-plugins',
    type: 'update_plugins',
    payload: { plugins: 'outdated' },
  });
  assert.equal(connectorTimeoutFor('update_plugins'), 90_000);
  assert.equal(connectorTimeoutFor('restore_plugins'), 60_000);
  assert.equal(connectorTimeoutFor('set_default_role'), 10_000);

  const id = 'a'.repeat(32);
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'restore_plugins', payload: { restorePoints: [id] } })?.payload, {
    restorePoints: [id],
  });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'restore_plugins', payload: { restorePoints: ['../x'] } }), null);
  assert.equal(parseRollbackRequest({ id: 'r', type: 'restore_plugins', payload: { restorePoints: [] } }), null);
  assert.equal(parseRollbackRequest({ id: 'r', type: 'update_plugins', payload: { plugins: 'outdated' } }), null);
});

test('plugin update verification: the site must load and no installable update may remain', async () => {
  const fixer = getFixer('wordpress-update-plugins')!;
  const action = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ pluginUpdates: true }),
    findings: [{ id: 'wp-outdated-plugins', actionId: fixer.id }],
  }).actions[0];
  const original = globalThis.fetch;
  const auditWith = (updatesAvailable: number, updatesWithoutPackage: number) => {
    const audit: any = clone(audit17);
    audit.plugins.updatesAvailable = updatesAvailable;
    audit.plugins.updatesWithoutPackage = updatesWithoutPackage;
    return audit;
  };
  const site = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;

  try {
    globalThis.fetch = (async () => new Response(JSON.stringify(auditWith(1, 1)), { status: 200 })) as unknown as typeof fetch;
    const done = await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action, fetchImpl: site(200, '<html>ok</html>') });
    assert.equal(done.success, true, 'a licence-only update does not count against the run');

    const broken = await fixer.verify({
      siteUrl: 'https://example.test',
      tokenHash: 'x',
      action,
      fetchImpl: site(200, '<p>There has been a critical error on this website.</p>'),
    });
    assert.equal(broken.success, false);
    assert.equal(broken.checks.find((c) => c.name === 'site-loads')?.ok, false);

    globalThis.fetch = (async () => new Response(JSON.stringify(auditWith(2, 0)), { status: 200 })) as unknown as typeof fetch;
    const remaining = await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action, fetchImpl: site(200, 'ok') });
    assert.equal(remaining.success, false, 'updates left for the next run keep it unverified');
  } finally {
    globalThis.fetch = original;
  }
});
