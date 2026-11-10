import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTOMATIC_FIXER_IDS } from '@/lib/engine/fixers/catalog';
import { SECURITY_HEADER_RULES } from '@/lib/engine/security/headers';
import { connectPreview, CONNECT_FIXES, problemIdsFrom } from './connect-preview';

test('sorts public findings into one-click fixes and tested ones', () => {
  const preview = connectPreview(['sec-csp', 'sec-version-disclosure', 'sec-wp-xmlrpc', 'sec-hsts', 'sec-wp-xmlrpc']);
  assert.deepEqual(preview.automatic, ['sec-wp-xmlrpc', 'sec-hsts']);
  assert.deepEqual(preview.tested, ['sec-csp']);
});

test('header findings promised as automatic have an automatic fixer', () => {
  for (const rule of SECURITY_HEADER_RULES) {
    if (CONNECT_FIXES[rule.id] !== 'automatic') continue;
    assert.equal(rule.fix?.automation, 'auto', rule.id);
    assert.ok(AUTOMATIC_FIXER_IDS.has(rule.fix!.fixerId), rule.id);
  }
});

test('reads every problem id, falling back to the top findings', () => {
  assert.deepEqual(
    problemIdsFrom({
      security: { problemIds: ['sec-csp', 'sec-hsts'], topFindings: [{ id: 'sec-csp' }] },
      seo: { topFindings: [{ id: 'seo-h1' }] },
      content: undefined,
    }),
    ['sec-csp', 'sec-hsts', 'seo-h1'],
  );
});
