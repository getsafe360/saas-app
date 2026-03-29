import assert from 'node:assert/strict';
import test from 'node:test';
import type { CockpitEvent } from '../cockpit/sse-events';
import {
  applyFallbackResult,
  reduceHomepageEvent,
  shouldInvokeFallbackOnSseClose,
  type HomepageTestState,
} from './homepage-test-core';

const baseState: HomepageTestState = {
  phase: 'running',
  progress: 42,
  categories: [],
  greeting: 'Hi',
  summary: 'working',
  testId: 'old-test',
  currentTestId: 'old-test',
  testedUrl: 'https://example.com',
  platform: 'generic',
  timestamp: '2026-01-01T00:00:00.000Z',
};

test('applyFallbackResult does not overwrite when current testId changed', () => {
  const next = applyFallbackResult(
    { ...baseState, currentTestId: 'new-test', testId: 'new-test' },
    'old-test',
    { summary: 'stale result' },
  );

  assert.equal(next.summary, 'working');
  assert.equal(next.currentTestId, 'new-test');
  assert.equal(next.phase, 'running');
});

test('terminal events stop spinner and set progress to 100', () => {
  const terminalStatus: CockpitEvent = { type: 'status', state: 'completed', message: 'done' };
  const next = reduceHomepageEvent(baseState, terminalStatus, 'old-test');

  assert.equal(next.phase, 'completed');
  assert.equal(next.progress, 100);
});

test('non-terminal event keeps state scoped to matching test id', () => {
  const progressEvent: CockpitEvent = { type: 'progress', progress: 75, message: 'Scanning' };
  const stale = reduceHomepageEvent(baseState, progressEvent, 'other-test');
  assert.equal(stale.progress, 42);

  const live = reduceHomepageEvent(baseState, progressEvent, 'old-test');
  assert.equal(live.progress, 75);
  assert.equal(live.phase, 'running');
});

test('fallback is invoked when SSE closes without terminal events', () => {
  assert.equal(shouldInvokeFallbackOnSseClose(false), true);
  assert.equal(shouldInvokeFallbackOnSseClose(true), false);
});
