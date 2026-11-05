import assert from 'node:assert/strict';
import test from 'node:test';

import audit from './__fixtures__/audit-wp-7.1.4.json';
import { parseWordPressAudit } from '@/lib/wordpress/audit-types';
import { buildWordPressFacts } from './facts';
import { phpSupportStatus } from './audit-rules';
import { evaluateWordPressHealthFromApiData } from './view';

// Real response captured from plugin 1.6.0 on WordPress 7.1.4 (installed with
// the "admin" login, one PHP file planted in uploads, checksums unreachable).
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function apiData(auditOverride?: unknown) {
  return {
    connectionStatus: { isConnected: true },
    isHttps: true,
    headers: { 'content-encoding': 'br' },
    cms: { type: 'wordpress', wp: { version: '7.1.4' } },
    wordpressTelemetry: {
      latestVersion: '7.1.4',
      snapshot: {
        inspectedAt: '2026-11-06T00:00:00.000Z',
        wpVersion: '7.1.4',
        activePlugins: ['getsafe360-connector/getsafe360-connector.php'],
        protections: { disableXmlRpc: false, blockUserEnumeration: true },
        audit: auditOverride === undefined ? audit : auditOverride,
      },
    },
  };
}

const findingsById = (data: Record<string, any>) =>
  new Map(evaluateWordPressHealthFromApiData(data).findings.map((finding) => [finding.id, finding]));

test('accepts the real plugin response and rejects malformed or future schemas', () => {
  assert.ok(parseWordPressAudit(audit));
  assert.equal(parseWordPressAudit({ ...audit, schema: 2 }), null);
  assert.equal(parseWordPressAudit({ schema: 1, core: {} }), null);
  assert.equal(parseWordPressAudit('nope'), null);
});

test('audit fields map into facts; missing audit leaves them null', () => {
  const facts = buildWordPressFacts(apiData());
  assert.equal(facts.security.hasAdminUsername, true);
  assert.equal(facts.security.saltsConfigured, true);
  assert.equal(facts.security.openAdminRegistration, false);
  assert.equal(facts.performance.memoryLimitBytes, -1);
  assert.equal(facts.redFlags.uploadsPhpFiles, 1);
  assert.equal(facts.redFlags.coreModifiedFiles, null);

  const without = buildWordPressFacts(apiData(null));
  assert.equal(without.security.hasAdminUsername, null);
  assert.equal(without.database.autoloadBytes, null);
  assert.equal(without.cron.overdue, null);
  assert.equal(without.plugins.inactive, null);
});

test('real audit turns unknown checks into observed results', () => {
  const byId = findingsById(apiData());
  assert.equal(byId.get('wp-admin-username')?.status, 'fail');
  assert.equal(byId.get('wp-admin-username')?.selectedByDefault, true, 'high + guided fix is offered by default');
  assert.equal(byId.get('wp-salts')?.status, 'pass');
  assert.equal(byId.get('wp-https')?.status, 'pass');
  assert.equal(byId.get('wp-file-editing')?.status, 'fail');
  assert.equal(byId.get('wp-xmlrpc')?.status, 'fail', 'XML-RPC enabled per WordPress itself');
  assert.equal(byId.get('wp-memory-limit')?.status, 'pass', '-1 means unlimited');
  assert.equal(byId.get('wp-php-version')?.status, 'pass');
  assert.equal(byId.get('wp-unused-themes')?.status, 'warn');
  assert.equal(byId.get('wp-inactive-plugins')?.status, 'warn');
  assert.equal(byId.get('red-flag-uploads-php')?.status, 'fail');
  assert.equal(byId.get('red-flag-core-modifications')?.status, 'unknown', 'checksums were unreachable');
  assert.equal(byId.get('wp-theme-update')?.status, 'unknown', 'update data not fetched yet');

  const withoutAudit = findingsById(apiData(null));
  for (const id of ['wp-admin-username', 'wp-salts', 'wp-autoload-size', 'wp-cron', 'red-flag-uploads-php']) {
    assert.equal(withoutAudit.get(id)?.status, 'unknown', `${id} stays unknown without the audit`);
  }
});

test('audit raises coverage and turns the score into an observed one', () => {
  const withAudit = evaluateWordPressHealthFromApiData(apiData()).score;
  const withoutAudit = evaluateWordPressHealthFromApiData(apiData(null)).score;
  assert.ok(withAudit.coverage > withoutAudit.coverage + 0.3, `${withAudit.coverage} vs ${withoutAudit.coverage}`);
  assert.equal(typeof withAudit.overall, 'number');
  assert.equal(typeof withAudit.categories['red-flags']?.score, 'number');
});

test('thresholds: autoload, cron, debug display, open admin registration, core files', () => {
  const tweaked = clone(audit) as any;
  tweaked.database.autoloadBytes = 1.5 * 1024 * 1024;
  tweaked.cron.disabled = true;
  tweaked.cron.overdue = 3;
  tweaked.security.debug = true;
  tweaked.security.debugDisplay = true;
  tweaked.security.usersCanRegister = true;
  tweaked.security.defaultRoleIsAdmin = true;
  tweaked.redFlags.coreModifiedFiles = 2;

  const byId = findingsById(apiData(tweaked));
  assert.equal(byId.get('wp-autoload-size')?.status, 'fail');
  assert.equal(byId.get('wp-autoload-size')?.evidence?.observed, '1.5 MB');
  assert.equal(byId.get('wp-cron')?.status, 'fail');
  assert.equal(byId.get('wp-debug-mode')?.status, 'fail');
  assert.equal(byId.get('wp-debug-mode')?.severity, 'high');
  assert.equal(byId.get('wp-open-admin-registration')?.status, 'fail');
  assert.equal(byId.get('wp-open-admin-registration')?.severity, 'critical');
  assert.equal(byId.get('red-flag-core-modifications')?.status, 'fail');

  tweaked.database.autoloadBytes = 700 * 1024;
  tweaked.cron.disabled = false;
  assert.equal(findingsById(apiData(tweaked)).get('wp-autoload-size')?.status, 'warn');
  assert.equal(findingsById(apiData(tweaked)).get('wp-cron')?.status, 'pass', 'few overdue tasks with WP-Cron on');
});

test('core version falls back to the site update check when wordpress.org is unreachable', () => {
  const data = apiData() as any;
  data.wordpressTelemetry.latestVersion = null;
  const tweaked = clone(audit) as any;
  tweaked.core.updateAvailable = true;
  data.wordpressTelemetry.snapshot.audit = tweaked;
  assert.equal(findingsById(data).get('wp-core-version')?.status, 'fail');

  tweaked.core.updateAvailable = null;
  assert.equal(findingsById(data).get('wp-core-version')?.status, 'unknown', 'never assumes the site is current');
});

test('PHP support follows php.net end-of-life dates', () => {
  const nov2026 = new Date('2026-11-06T00:00:00Z');
  assert.equal(phpSupportStatus('7.4.33', nov2026).status, 'eol');
  assert.equal(phpSupportStatus('8.1.30', nov2026).status, 'eol');
  assert.equal(phpSupportStatus('8.2.29', nov2026).status, 'ending');
  assert.equal(phpSupportStatus('8.3.6', nov2026).status, 'supported');
  assert.equal(phpSupportStatus('8.6.0', nov2026).status, 'supported', 'newer than the table');
  assert.equal(phpSupportStatus('8.2.29', new Date('2027-01-02T00:00:00Z')).status, 'eol');
  assert.equal(phpSupportStatus('garbage').status, 'unknown');
});
