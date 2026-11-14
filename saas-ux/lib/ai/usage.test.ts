import assert from 'node:assert/strict';
import test from 'node:test';

import { totalTokensOf } from './usage';

test('token totals from V2 and V3 usage shapes', () => {
  assert.equal(totalTokensOf({ inputTokens: 1200, outputTokens: 300, totalTokens: 1500 }), 1500, 'V2 total');
  assert.equal(totalTokensOf({ inputTokens: 1200, outputTokens: 300 }), 1500, 'V2 without total');
  assert.equal(
    totalTokensOf({
      inputTokens: { total: 1200, noCache: 1200, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 300, text: 300, reasoning: 0 },
    }),
    1500,
    'V3 nested (@ai-sdk/anthropic@3)',
  );
  assert.equal(totalTokensOf({ inputTokens: { total: undefined }, outputTokens: {} }), undefined, 'nothing reported');
  assert.equal(totalTokensOf(undefined), undefined);
});
