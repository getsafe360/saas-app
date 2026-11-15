import assert from 'node:assert/strict';
import test from 'node:test';

import { selectNextSeoIssue } from './categories/seoLoop';
import type { SiteSnapshot } from './types';

const snapshot = (ids: string[], verified = false): SiteSnapshot => ({
  siteId: 's', siteUrl: 'https://sk-rent.de/', scores: { seo: 97 }, seoFactsVerified: verified, seoFacts: {},
  findings: ids.map((id) => ({ id, title: id, severity: 'low', passed: false })),
});

test('the SEO loop fixes social tags, then the extra H1s, from the open findings of a cockpit scan', () => {
  const first = selectNextSeoIssue(snapshot(['seo-og-missing', 'seo-h1-multiple']), []);
  assert.equal(first?.fixPlan.fixType, 'connector_action');
  assert.deepEqual(first?.fixPlan.connectorAction, { type: 'set_social_tags', payload: { enabled: true } });
  const second = selectNextSeoIssue(snapshot(['seo-og-missing', 'seo-h1-multiple']), ['seo-og-missing']);
  assert.equal(second?.fixPlan.connectorAction?.type, 'set_heading_fix');
  assert.equal(second?.fixPlan.measureHeadingStyle, true);
  assert.equal(selectNextSeoIssue(snapshot(['seo-og-missing', 'seo-h1-multiple']), ['seo-og-missing', 'seo-h1-multiple']), null);
});

test('the loop never writes page-specific tags as site-wide snippets', () => {
  // Unverified facts look like "everything missing": nothing but connector fixes may come out of it.
  for (let attempted: string[] = [], next = selectNextSeoIssue(snapshot([], false), attempted); next; next = selectNextSeoIssue(snapshot([], false), attempted)) {
    attempted.push(next.issue.id);
  }
  const verified = snapshot([], true);
  verified.seoFacts = { pageTitle: 'Home', metaDescription: undefined, hasCanonical: false, hasOgTitle: false, hasTwitterCard: false };
  const ids: string[] = [];
  for (let next = selectNextSeoIssue(verified, ids); next; next = selectNextSeoIssue(verified, ids)) {
    ids.push(next.issue.id);
    assert.ok(!/canonical|description|og:|twitter:/.test(next.fixPlan.connectorFix.snippet ?? ''), next.issue.id);
  }
});
