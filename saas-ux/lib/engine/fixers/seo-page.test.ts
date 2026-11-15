import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRollbackRequest } from '@/lib/wordpress/rollback';
import type { WordPressPlannedAction } from '@/lib/wordpress/types';
import { AUTOMATIC_FIXER_IDS } from './catalog';
import { singleH1Fixer, socialTagsFixer } from './wordpress/seo-page';

const planned = (template: NonNullable<ReturnType<typeof socialTagsFixer.plan>>): WordPressPlannedAction =>
  ({ id: 'run-1', ...template } as unknown as WordPressPlannedAction);
const html = (body: string) => async () => new Response(`<html><head>${body}</head><body></body></html>`, { status: 200 });

test('social tags: planned for either finding, free and low-risk, verified on the home page', async () => {
  assert.equal(socialTagsFixer.plan([{ id: 'seo-h1-missing' }]), null);
  const plan = socialTagsFixer.plan([{ id: 'seo-og-missing' }], { seo: { socialImage: false } as never })!;
  assert.deepEqual(plan.payload, { enabled: true });
  assert.equal(plan.risk, 'low');
  assert.match(plan.description, /no logo or icon/);
  assert.ok(socialTagsFixer.plan([{ id: 'seo-social-tags' }]));
  assert.deepEqual(socialTagsFixer.toConnectorRequest(planned(plan)), { id: 'run-1', type: 'set_social_tags', payload: { enabled: true } });

  const ok = await socialTagsFixer.verify({ siteUrl: 'https://a.de/', tokenHash: 'x', action: planned(plan), fetchImpl: html('<meta property="og:title" content="A"><meta name="twitter:card" content="summary">') as never });
  assert.equal(ok.success, true);
  const missing = await socialTagsFixer.verify({ siteUrl: 'https://a.de/', tokenHash: 'x', action: planned(plan), fetchImpl: html('<title>A</title>') as never });
  assert.equal(missing.success, false);
});

test('single H1: keeps the look when measured, otherwise waits for the user; verified by counting H1s', async () => {
  assert.equal(singleH1Fixer.plan([{ id: 'seo-og-missing' }]), null);
  const kept = singleH1Fixer.plan([{ id: 'seo-h1-multiple' }], { headingStyle: { 'font-size': '44px', 'font-weight': '700' } })!;
  assert.equal(kept.risk, 'low');
  assert.equal(kept.requiresApproval, false);
  assert.deepEqual(kept.payload, { enabled: true, style: { 'font-size': '44px', 'font-weight': '700' } });
  const unmeasured = singleH1Fixer.plan([{ id: 'seo-h1-multiple' }], { headingStyle: null })!;
  assert.equal(unmeasured.risk, 'medium');
  assert.equal(unmeasured.requiresApproval, true);

  const request = singleH1Fixer.toConnectorRequest(planned({ ...kept, payload: { enabled: true, style: { 'font-size': '44px', color: 'red', 'font-family': 'x;}body{display:none' } } }));
  assert.deepEqual(request?.payload, { enabled: true, style: { 'font-size': '44px' } }, 'only safe computed values reach the connector');

  const one = await singleH1Fixer.verify({ siteUrl: 'https://a.de/', tokenHash: 'x', action: planned(kept), fetchImpl: (async () => new Response('<html><body><h1>A</h1><h2 class="gs360-h1">B</h2></body></html>')) as never });
  assert.equal(one.success, true);
  const three = await singleH1Fixer.verify({ siteUrl: 'https://a.de/', tokenHash: 'x', action: planned(kept), fetchImpl: (async () => new Response('<html><body><h1>A</h1><h1>B</h1><h1>C</h1></body></html>')) as never });
  assert.equal(three.success, false);
});

test('both are automatic fixes, and their undo requests parse strictly', () => {
  assert.ok(AUTOMATIC_FIXER_IDS.has('seo-social-tags') && AUTOMATIC_FIXER_IDS.has('seo-single-h1'));
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_social_tags', payload: { enabled: false } })?.payload, { enabled: false });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_social_tags', payload: { enabled: 'no' } }), null);
  assert.deepEqual(
    parseRollbackRequest({ id: 'r', type: 'set_heading_fix', payload: { enabled: false, style: { 'font-size': '40px', 'margin-top': 'url(x)' } } })?.payload,
    { enabled: false, style: { 'font-size': '40px' } },
  );
});
