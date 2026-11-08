import assert from 'node:assert/strict';
import test from 'node:test';

import { pickDefaultFocus, resolveFocus } from './focus';

test('opens on the category with the most critical issues', () => {
  assert.equal(
    pickDefaultFocus([
      { id: 'performance', score: 60, critical: 0, warnings: 3 },
      { id: 'security', score: 81, critical: 1, warnings: 1 },
      { id: 'seo', score: 97, critical: 0, warnings: 1 },
    ]),
    'security',
  );
});

test('without critical issues, the lowest score wins, then more warnings', () => {
  assert.equal(
    pickDefaultFocus([
      { id: 'performance', score: 91, critical: 0, warnings: 0 },
      { id: 'wordpress', score: 78, critical: 0, warnings: 7 },
      { id: 'accessibility', score: 83, critical: 0, warnings: 0 },
    ]),
    'wordpress',
  );
  assert.equal(
    pickDefaultFocus([
      { id: 'seo', score: 90, critical: 0, warnings: 1 },
      { id: 'content', score: 90, critical: 0, warnings: 2 },
    ]),
    'content',
  );
});

test('unscored categories are not picked over scored ones', () => {
  assert.equal(
    pickDefaultFocus([
      { id: 'wordpress', score: null, critical: 0, warnings: 0 },
      { id: 'seo', score: 99, critical: 0, warnings: 0 },
    ]),
    'seo',
  );
  assert.equal(pickDefaultFocus([]), null);
});

test('a stored choice is kept only while that category is on the page', () => {
  const available = ['performance', 'security', 'seo'] as const;
  assert.equal(resolveFocus('seo', available, 'security'), 'seo');
  assert.equal(resolveFocus('all', available, 'security'), 'all');
  assert.equal(resolveFocus('wordpress', available, 'security'), 'security');
  assert.equal(resolveFocus(null, available, null), 'all');
});
