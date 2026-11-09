import assert from 'node:assert/strict';
import test from 'node:test';

import { toAppliedChanges, type ActionRunRow } from './applied-changes';

const inverse = (id: string) => ({ id, type: 'set_security_headers', payload: { headers: { 'X-Frame-Options': null } } });

const run = (partial: Partial<ActionRunRow> & { id: string }): ActionRunRow => ({
  actionId: 'security-headers',
  status: 'applied',
  rollbackPayload: inverse('security-headers'),
  startedAt: '2026-11-08T20:00:00Z',
  title: 'Send security headers',
  inputPayload: { planAction: { payload: { sourceFindingIds: ['sec-hsts', 'sec-nosniff'] } }, findingId: 'sec-hsts' },
  verificationOk: true,
  completedAt: '2026-11-08T20:00:05Z',
  ...partial,
});

test('lists only changes that touched the site, newest first', () => {
  const changes = toAppliedChanges([
    run({ id: 'old', startedAt: '2026-11-07T10:00:00Z' }),
    run({ id: 'skipped', status: 'skipped', rollbackPayload: null }),
    run({ id: 'failed-before-change', status: 'failed', rollbackPayload: null }),
    run({ id: 'new', startedAt: '2026-11-08T21:00:00Z', actionId: 'wordpress-block-user-enumeration', rollbackPayload: { id: 'x', type: 'update_connector_setting', payload: { key: 'blockUserEnumeration', enabled: false } } }),
  ]);
  assert.deepEqual(changes.map((c) => c.runId), ['new', 'old']);
  assert.deepEqual(changes[1].findingIds, ['sec-hsts', 'sec-nosniff']);
});

test('state: verified, applied but not visible, undone', () => {
  const [active] = toAppliedChanges([run({ id: 'a' })]);
  assert.equal(active.state, 'active');
  assert.equal(active.undoable, true);

  const [unverified] = toAppliedChanges([run({ id: 'b', status: 'failed', verificationOk: false })]);
  assert.equal(unverified.state, 'unverified');
  assert.equal(unverified.undoable, true);

  const [undone] = toAppliedChanges([run({ id: 'c', status: 'rolled_back', completedAt: '2026-11-08T22:00:00Z' })]);
  assert.equal(undone.state, 'undone');
  assert.equal(undone.undoable, false);
  assert.equal(undone.undoneAt, '2026-11-08T22:00:00.000Z');
});

test('only the newest change to a setting can be undone, as the rollback route requires', () => {
  const changes = toAppliedChanges([
    run({ id: 'older', startedAt: '2026-11-07T10:00:00Z' }),
    run({ id: 'newer', startedAt: '2026-11-08T10:00:00Z' }),
  ]);
  const byId = new Map(changes.map((c) => [c.runId, c]));
  assert.equal(byId.get('newer')?.undoable, true);
  assert.equal(byId.get('older')?.undoable, false);

  // Once the newer one is undone, the older one becomes undoable.
  const after = toAppliedChanges([
    run({ id: 'older', startedAt: '2026-11-07T10:00:00Z' }),
    run({ id: 'newer', startedAt: '2026-11-08T10:00:00Z', status: 'rolled_back' }),
  ]);
  assert.equal(after.find((c) => c.runId === 'older')?.undoable, true);
});

test('falls back to the single finding id and respects the limit', () => {
  const [change] = toAppliedChanges([run({ id: 'x', inputPayload: { findingId: 'wp-xmlrpc' } })]);
  assert.deepEqual(change.findingIds, ['wp-xmlrpc']);
  const many = Array.from({ length: 30 }, (_, i) => run({ id: `r${i}`, startedAt: new Date(2026, 0, i + 1).toISOString() }));
  assert.equal(toAppliedChanges(many, 5).length, 5);
});

test('one-way changes are listed as permanent, never undoable', () => {
  const changes = toAppliedChanges([
    run({ id: 'cleanup', actionId: 'wordpress-limit-revisions', rollbackPayload: null }),
    run({ id: 'refused', actionId: 'wordpress-limit-revisions', status: 'failed', rollbackPayload: null }),
    run({ id: 'guided', actionId: 'wordpress-update-core', rollbackPayload: null }),
  ]);
  assert.deepEqual(changes.map((c) => c.runId), ['cleanup'], 'only applied one-way fixers count; refusals and guided runs do not');
  assert.equal(changes[0].permanent, true);
  assert.equal(changes[0].undoable, false);
  assert.equal(changes[0].state, 'active');

  const [reversible] = toAppliedChanges([run({ id: 'headers' })]);
  assert.equal(reversible.permanent, false);
});
