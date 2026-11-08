import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTOMATIC_FIXER_IDS, fixModeFor } from '@/lib/engine/fixers/catalog';
import { listFixers } from '@/lib/engine/fixers/registry';
import { WORDPRESS_RULES } from '@/lib/engine/wordpress/rules';
import { WORDPRESS_AUDIT_RULES } from '@/lib/engine/wordpress/audit-rules';
import { SECURITY_HEADER_RULES } from '@/lib/engine/security/headers';
import { EMAIL_DNS_RULES } from '@/lib/engine/security/email-dns';
import { toRemediationItems, type ExecutionResultLike } from './remediation-result';

test('the automatic catalog lists exactly the registered fixers', () => {
  assert.deepEqual([...AUTOMATIC_FIXER_IDS].sort(), listFixers().map((fixer) => fixer.id).sort());
});

test('every rule marked auto has a registered fixer', () => {
  const rules = [...WORDPRESS_RULES, ...WORDPRESS_AUDIT_RULES, ...SECURITY_HEADER_RULES, ...EMAIL_DNS_RULES];
  const autoWithoutFixer = rules
    .filter((rule) => rule.fix?.automation === 'auto' && !AUTOMATIC_FIXER_IDS.has(rule.fix.fixerId))
    .map((rule) => rule.id);
  assert.deepEqual(autoWithoutFixer, []);
});

test('fix mode: only auto + registered fixer is automatic', () => {
  assert.equal(fixModeFor('security-headers', 'auto'), 'automatic');
  assert.equal(fixModeFor('security-headers', 'guided'), 'guided');
  assert.equal(fixModeFor('wordpress-update-plugins', 'auto'), 'guided');
  assert.equal(fixModeFor('wordpress-upgrade-php', 'manual'), 'manual');
  assert.equal(fixModeFor(undefined, undefined), 'manual');
});

const plan = {
  actions: [
    {
      id: 'security-headers',
      payload: { sourceFindingIds: ['sec-hsts', 'sec-xcto'], missingCapabilities: [] },
    },
    {
      id: 'wordpress-block-user-enumeration',
      payload: { sourceFindingIds: ['wp-user-enumeration'], missingCapabilities: ['securityBlockUserEnumeration'] },
    },
  ],
} as any;

const base: ExecutionResultLike = {
  findingId: 'sec-hsts',
  actionId: 'security-headers',
  status: 'applied',
  autoApplied: true,
  message: 'ok',
  skippedBySafeMode: false,
  verification: { success: true },
  rollback: { id: 'security-headers', type: 'set_security_headers', payload: { headers: {} } },
};

test('applied action covers all its findings and is undoable', () => {
  const [item] = toRemediationItems([base], plan, new Map([['security-headers', 'run-1']]));
  assert.deepEqual(item.findingIds, ['sec-hsts', 'sec-xcto']);
  assert.equal(item.reason, 'verified');
  assert.equal(item.runId, 'run-1');
  assert.equal(item.undoable, true);
});

test('verification failure after applying stays undoable', () => {
  const [item] = toRemediationItems(
    [{ ...base, status: 'failed', verification: { success: false } }],
    plan,
    new Map([['security-headers', 'run-1']]),
  );
  assert.equal(item.reason, 'verification_failed');
  assert.equal(item.undoable, true);
});

test('no run id or no inverse means no undo', () => {
  const [noRun] = toRemediationItems([base], plan, new Map());
  assert.equal(noRun.undoable, false);
  const [noInverse] = toRemediationItems([{ ...base, rollback: null }], plan, new Map([['security-headers', 'r']]));
  assert.equal(noInverse.undoable, false);
});

test('skipped reasons: missing capability, safe mode, connector refusal', () => {
  const skipped = { ...base, status: 'skipped' as const, autoApplied: false, verification: null, rollback: null };
  const [needsUpdate] = toRemediationItems(
    [{ ...skipped, actionId: 'wordpress-block-user-enumeration', findingId: 'wp-user-enumeration' }],
    plan,
    new Map(),
  );
  assert.equal(needsUpdate.reason, 'connector_update');

  const [safe] = toRemediationItems([{ ...skipped, skippedBySafeMode: true, actionId: 'x', findingId: 'x' }], plan, new Map());
  assert.equal(safe.reason, 'safe_mode');
  assert.deepEqual(safe.findingIds, ['x']);

  const [refused] = toRemediationItems([{ ...skipped, connectorResult: { status: 'skipped' } }], plan, new Map());
  assert.equal(refused.reason, 'connector_failed');
});

test('failure without a connector response is an error', () => {
  const [item] = toRemediationItems(
    [{ ...base, status: 'failed', verification: undefined, connectorResult: undefined, rollback: undefined }],
    plan,
    new Map(),
  );
  assert.equal(item.reason, 'error');
  assert.equal(item.undoable, false);
});
