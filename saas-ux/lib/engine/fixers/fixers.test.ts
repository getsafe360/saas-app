import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRules } from '../rules';
import { SECURITY_HEADER_RULES, buildSiteHeaderFacts } from '../security/headers';
import { createWordPressActionPlan } from '@/lib/wordpress/plan';
import type { WordPressCapabilitySummary, WordPressPlannedAction } from '@/lib/wordpress/types';
import { planRollback, parseRollbackRequest } from '@/lib/wordpress/rollback';
import { getFixer } from './registry';
import { securityHeadersFixer } from './wordpress/security-headers';

const capabilities = (raw: Record<string, boolean>): WordPressCapabilitySummary => ({
  read: true,
  write: true,
  themeFiles: false,
  mediaUpload: false,
  pageUpdate: false,
  rollback: true,
  raw,
});

const ALL_CAPS = capabilities({ securityHeaders: true, securityDisableXmlrpc: true, securityBlockUserEnumeration: true });

test('header rules: unknown without headers, pass/fail when observed', () => {
  const unknownRun = evaluateRules(SECURITY_HEADER_RULES, buildSiteHeaderFacts({}));
  assert.ok(unknownRun.every((finding) => finding.status === 'unknown'));

  const facts = buildSiteHeaderFacts({
    isHttps: true,
    headers: { 'X-Content-Type-Options': 'nosniff', 'content-security-policy': "frame-ancestors 'self'" },
  });
  const byId = new Map(evaluateRules(SECURITY_HEADER_RULES, facts).map((finding) => [finding.id, finding]));
  assert.equal(byId.get('sec-nosniff')?.status, 'pass');
  assert.equal(byId.get('sec-frame-options')?.status, 'pass', 'CSP frame-ancestors satisfies clickjacking');
  assert.equal(byId.get('sec-hsts')?.status, 'fail');
  assert.equal(byId.get('sec-referrer-policy')?.status, 'fail');
});

test('HSTS is not applicable on plain HTTP and is never preselected', () => {
  const http = new Map(
    evaluateRules(SECURITY_HEADER_RULES, buildSiteHeaderFacts({ isHttps: false, headers: { server: 'x' } })).map(
      (finding) => [finding.id, finding],
    ),
  );
  assert.equal(http.get('sec-hsts')?.status, 'not-applicable');

  const https = new Map(
    evaluateRules(SECURITY_HEADER_RULES, buildSiteHeaderFacts({ isHttps: true, headers: { server: 'x' } })).map(
      (finding) => [finding.id, finding],
    ),
  );
  const hsts = https.get('sec-hsts');
  assert.equal(hsts?.status, 'fail');
  assert.equal(hsts?.severity, 'high');
  // High severity, but browsers cache HSTS: available, not prechecked.
  assert.equal(hsts?.selectedByDefault, false);
  assert.equal(hsts?.fix?.fixerId, 'security-headers');
});

test('planner groups all selected header findings into one connector action', () => {
  const plan = createWordPressActionPlan({
    siteId: 's1',
    capabilities: ALL_CAPS,
    findings: [
      { id: 'sec-nosniff', actionId: 'security-headers' },
      { id: 'sec-frame-options', actionId: 'security-headers' },
      { id: 'wp-xmlrpc', actionId: 'wordpress-disable-xmlrpc' },
      { id: 'wp-core-version', actionId: 'wordpress-update-core' },
    ],
  });

  assert.equal(plan.actions.length, 3);
  const headers = plan.actions.find((action) => action.id === 'security-headers');
  assert.ok(headers);
  assert.equal(headers.type, 'set_security_headers');
  assert.equal(headers.risk, 'low');
  assert.equal(headers.autoApplyEligible, true);
  assert.deepEqual(headers.payload.headers, { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' });
  assert.deepEqual(headers.payload.sourceFindingIds, ['sec-nosniff', 'sec-frame-options']);

  const guided = plan.actions.find((action) => action.id === 'wordpress-update-core');
  assert.equal(guided?.type, 'verify_render');
  assert.equal(guided?.autoApplyEligible, false);
});

test('including HSTS raises the action risk; old connectors defer it', () => {
  const findings = [{ id: 'sec-hsts', actionId: 'security-headers' }];
  const withCap = createWordPressActionPlan({ siteId: 's', capabilities: ALL_CAPS, findings }).actions[0];
  assert.equal(withCap.risk, 'medium');
  assert.equal(withCap.autoApplyEligible, true);

  const oldConnector = createWordPressActionPlan({
    siteId: 's',
    capabilities: capabilities({ securityDisableXmlrpc: true }),
    findings,
  }).actions[0];
  assert.equal(oldConnector.autoApplyEligible, false);
  assert.equal(oldConnector.requiresApproval, true);
  assert.deepEqual(oldConnector.payload.missingCapabilities, ['securityHeaders']);
});

test('connector requests come from the registry and ignore unknown headers', () => {
  const action = createWordPressActionPlan({
    siteId: 's',
    capabilities: ALL_CAPS,
    findings: [{ id: 'sec-referrer-policy', actionId: 'security-headers' }, { id: 'sec-csp', actionId: 'security-headers' }],
  }).actions[0];

  const request = getFixer(action.id)?.toConnectorRequest(action);
  assert.deepEqual(request, {
    id: 'security-headers',
    type: 'set_security_headers',
    payload: { headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
  });

  const xmlrpc = createWordPressActionPlan({
    siteId: 's',
    capabilities: ALL_CAPS,
    findings: [{ id: 'wp-xmlrpc', actionId: 'wordpress-disable-xmlrpc' }],
  }).actions[0];
  assert.deepEqual(getFixer(xmlrpc.id)?.toConnectorRequest(xmlrpc), {
    id: 'wordpress-disable-xmlrpc',
    type: 'update_connector_setting',
    payload: { key: 'disableXmlRpc', enabled: true },
  });
});

function fakeFetch(headers: Record<string, string>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response('<html></html>', { status: 200, headers });
  }) as typeof fetch;
}

test('header verification checks the live response and busts caches', async () => {
  const action = {
    id: 'security-headers',
    payload: { headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' } },
  } as unknown as WordPressPlannedAction;

  const seen: string[] = [];
  const ok = await securityHeadersFixer.verify({
    siteUrl: 'https://example.com',
    tokenHash: 't',
    action,
    fetchImpl: fakeFetch({ 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN' }, seen),
  });
  assert.equal(ok.success, true);
  assert.match(seen[0], /gs360_verify=\d+/);

  const missing = await securityHeadersFixer.verify({
    siteUrl: 'https://example.com',
    tokenHash: 't',
    action,
    fetchImpl: fakeFetch({ 'x-content-type-options': 'nosniff' }),
  });
  assert.equal(missing.success, false);
  assert.match(missing.checks.find((check) => !check.ok)?.detail ?? '', /page cache/);
});

test('rollback replays stored inverses newest first and rejects unknown shapes', () => {
  const { planned, notReversible } = planRollback([
    {
      id: 'old',
      actionId: 'security-headers',
      status: 'applied',
      startedAt: '2026-11-01T10:00:00Z',
      rollbackPayload: { id: 'security-headers-rollback', type: 'set_security_headers', payload: { replace: true, headers: {} } },
    },
    {
      id: 'new',
      actionId: 'wordpress-disable-xmlrpc',
      status: 'applied',
      startedAt: '2026-11-02T10:00:00Z',
      rollbackPayload: {
        id: 'wordpress-disable-xmlrpc-rollback',
        type: 'update_connector_setting',
        payload: { key: 'disableXmlRpc', enabled: false },
      },
    },
    { id: 'skipped', actionId: 'x', status: 'skipped', startedAt: '2026-11-03T10:00:00Z', rollbackPayload: null },
    { id: 'guided', actionId: 'y', status: 'applied', startedAt: '2026-11-03T10:00:00Z', rollbackPayload: null },
  ]);

  assert.deepEqual(planned.map((entry) => entry.runId), ['new', 'old']);
  assert.deepEqual(notReversible, ['guided']);

  assert.equal(parseRollbackRequest({ id: 'a', type: 'update_connector_setting', payload: { key: 'rm -rf', enabled: true } }), null);
  assert.equal(parseRollbackRequest({ id: 'a', type: 'run_php', payload: {} }), null);
  assert.equal(parseRollbackRequest({ id: 'a', type: 'set_security_headers', payload: { headers: { X: 1 } } }), null);
});

const headersRun = (id: string, startedAt: string, status = 'applied') => ({
  id,
  actionId: 'security-headers',
  status,
  startedAt,
  rollbackPayload: { id: 'security-headers-rollback', type: 'set_security_headers', payload: { replace: true, headers: {} } },
});

test('rollback includes changes the connector applied even if verification failed', () => {
  const { planned } = planRollback([headersRun('cdn-cached', '2026-11-01T10:00:00Z', 'failed')]);
  assert.deepEqual(planned.map((entry) => entry.runId), ['cdn-cached']);
});

test('rollback refuses to replay an older snapshot under a newer change', () => {
  const older = headersRun('a', '2026-11-01T10:00:00Z');
  const newer = headersRun('b', '2026-11-02T10:00:00Z');

  const outOfOrder = planRollback([older], [older, newer]);
  assert.deepEqual(outOfOrder.planned, []);
  assert.deepEqual(outOfOrder.blocked, [{ runId: 'a', newerRunIds: ['b'] }]);

  const together = planRollback([older, newer], [older, newer]);
  assert.deepEqual(together.blocked, []);
  assert.deepEqual(together.planned.map((entry) => entry.runId), ['b', 'a']);

  const alreadyUndone = planRollback([older], [older, { ...newer, status: 'rolled_back' }]);
  assert.deepEqual(alreadyUndone.planned.map((entry) => entry.runId), ['a']);
});
