import assert from 'node:assert/strict';
import test from 'node:test';

import audit17 from '../wordpress/__fixtures__/audit-wp-7.1.4-plugin-1.7.json';
import { evaluateWordPressHealthFromApiData } from '../wordpress/view';
import { fixModeFor } from './catalog';
import { getFixer } from './registry';
import { isCorePath, parseCoreFiles } from '@/lib/wordpress/core-files';
import { createWordPressActionPlan } from '@/lib/wordpress/plan';
import { parseRollbackRequest } from '@/lib/wordpress/rollback';
import { connectorTimeoutFor } from '@/lib/wordpress/timeouts';
import type { WordPressCapabilitySummary } from '@/lib/wordpress/types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const capabilities = (raw: Record<string, boolean>): WordPressCapabilitySummary => ({
  read: true,
  write: true,
  themeFiles: false,
  mediaUpload: false,
  pageUpdate: false,
  rollback: true,
  raw,
});

const findings = (audit: unknown) =>
  new Map(
    evaluateWordPressHealthFromApiData({
      connectionStatus: { isConnected: true },
      cms: { type: 'wordpress' },
      wordpressTelemetry: { snapshot: { inspectedAt: '2026-11-09T00:00:00Z', audit } },
    }).findings.map((finding) => [finding.id, finding]),
  );

test('core integrity findings: automatic restore and quarantine, never ticked in advance', () => {
  const audit: any = clone(audit17);
  audit.redFlags = { ...audit.redFlags, coreModifiedFiles: 2, unexpectedCoreFiles: 1 };
  const byId = findings(audit);

  const modified = byId.get('red-flag-core-modifications');
  assert.equal(modified?.status, 'fail');
  assert.equal(modified?.fix?.fixerId, 'wordpress-restore-core-files');
  assert.equal(fixModeFor(modified?.fix?.fixerId, modified?.fix?.automation), 'automatic');
  assert.equal(modified?.selectedByDefault, false);

  const unexpected = byId.get('red-flag-unexpected-core-files');
  assert.equal(unexpected?.status, 'fail');
  assert.equal(unexpected?.severity, 'critical');
  assert.equal(unexpected?.summary, '1 PHP file in wp-admin or wp-includes is not part of WordPress.');
  assert.equal(fixModeFor(unexpected?.fix?.fixerId, unexpected?.fix?.automation), 'automatic');
  assert.equal(unexpected?.selectedByDefault, false, 'medium risk: the user decides after reviewing');
});

test('connectors before 1.9 leave the unexpected-files check unknown', () => {
  const finding = findings(audit17).get('red-flag-unexpected-core-files');
  assert.equal(finding?.status, 'unknown');
  assert.equal(finding?.summary, 'Needs the GetSafe 360 plugin 1.9 or newer.');
});

test('core paths: never wp-config.php, wp-content or traversal', () => {
  assert.ok(isCorePath('wp-includes/version.php'));
  assert.ok(isCorePath('wp-login.php'));
  for (const bad of ['wp-config.php', 'wp-content/plugins/x.php', '../etc/passwd', 'wp-includes/../wp-config.php', 'a b.php', 42]) {
    assert.equal(isCorePath(bad), false, String(bad));
  }
  const parsed = parseCoreFiles({
    success: true,
    version: '7.1.4',
    modified: ['wp-includes/version.php', 'wp-config.php'],
    unexpected: ['wp-includes/x.php', '../evil.php'],
    complete: true,
  });
  assert.deepEqual(parsed?.modified, ['wp-includes/version.php']);
  assert.deepEqual(parsed?.unexpected, ['wp-includes/x.php']);
  assert.equal(parseCoreFiles({ modified: 'x' }), null);
});

test('core fixes send fixed requests with longer timeouts and undo through a restore point', () => {
  const plan = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ coreIntegrity: true }),
    findings: [
      { id: 'red-flag-core-modifications', actionId: 'wordpress-restore-core-files' },
      { id: 'red-flag-unexpected-core-files', actionId: 'wordpress-quarantine-core-files' },
    ],
  });
  const requests = plan.actions.map((action) => getFixer(action.id)!.toConnectorRequest(action));
  assert.deepEqual(requests, [
    { id: 'wordpress-restore-core-files', type: 'restore_core_files', payload: { paths: 'modified' } },
    { id: 'wordpress-quarantine-core-files', type: 'quarantine_core_files', payload: { paths: 'unexpected' } },
  ]);
  assert.ok(plan.actions.every((action) => action.autoApplyEligible && action.risk === 'medium'));
  assert.equal(connectorTimeoutFor('restore_core_files'), 60_000);

  const older = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ pluginUpdates: true }),
    findings: [{ id: 'red-flag-core-modifications', actionId: 'wordpress-restore-core-files' }],
  });
  assert.equal(older.actions[0].autoApplyEligible, false);
  assert.match(older.actions[0].description, /connector 1\.9 or newer/);

  const id = 'c'.repeat(32);
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'restore_core_backup', payload: { restorePoint: id } })?.payload, {
    restorePoint: id,
  });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'restore_core_backup', payload: { restorePoint: '../x' } }), null);
  assert.equal(parseRollbackRequest({ id: 'r', type: 'restore_core_files', payload: { paths: 'modified' } }), null);
});

test('verification asks the connector whether any modified or unexpected file remains', async () => {
  const original = globalThis.fetch;
  const fixer = getFixer('wordpress-quarantine-core-files')!;
  const action = createWordPressActionPlan({
    siteId: 's1',
    capabilities: capabilities({ coreIntegrity: true }),
    findings: [{ id: 'red-flag-unexpected-core-files', actionId: fixer.id }],
  }).actions[0];
  const respond = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  try {
    globalThis.fetch = respond({ success: true, version: '7.1.4', modified: ['wp-includes/version.php'], unexpected: [], complete: true });
    assert.equal((await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action })).success, true, 'quarantine only checks unexpected files');

    globalThis.fetch = respond({ success: true, version: '7.1.4', modified: [], unexpected: ['wp-includes/x.php'], complete: true });
    const left = await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action });
    assert.equal(left.success, false);
    assert.match(left.checks[0].detail ?? '', /1 unexpected file/);

    globalThis.fetch = respond({ success: true, version: '7.1.4', modified: [], unexpected: [], complete: false });
    assert.equal((await fixer.verify({ siteUrl: 'https://example.test', tokenHash: 'x', action })).success, false, 'an incomplete scan proves nothing');
  } finally {
    globalThis.fetch = original;
  }
});
