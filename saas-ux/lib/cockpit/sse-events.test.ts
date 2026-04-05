import assert from 'node:assert/strict';
import test from 'node:test';
import { mapBackendEvent } from './sse-events';

test('mapBackendEvent maps category events with category + issues', () => {
  const mapped = mapBackendEvent('test-1', 'category', {
    category: 'performance',
    issues: [{ id: 'img-size' }, { id: 'js-bundle' }],
    message: '2 issues detected',
  });

  assert.deepEqual(mapped, {
    type: 'category',
    category: 'performance',
    issues: [{ id: 'img-size' }, { id: 'js-bundle' }],
    message: '2 issues detected',
  });
});

test('mapBackendEvent drops malformed category events', () => {
  const mapped = mapBackendEvent('test-1', 'category', {
    issues: [{ id: 'no-category' }],
  });

  assert.equal(mapped, null);
});
