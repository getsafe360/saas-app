import assert from 'node:assert/strict';
import test from 'node:test';

import { blendCategoryScores, evaluatePageScan } from './scan';
import { evaluatePageCards } from './view';

const site = {
  finalUrl: 'https://example.com/',
  isHttps: true,
  siteLang: 'de',
  cms: { type: 'unknown', signals: [] },
  meta: {
    title: 'Kfz-Zulassungsdienst in Berlin-Steglitz',
    description: 'x'.repeat(131),
    titleLen: 39,
    descriptionLen: 131,
    robotsMeta: 'index,follow',
    hasCanonical: true,
    hasJsonLd: true,
    hasOgTitle: true,
    hasOgImage: false,
  },
  dom: { h1Count: 2, imgCount: 6, scriptCount: 11 },
  accessibility: { imgMissingAlt: 0, imgWithoutAltRatio: 0 },
  perfHints: { approxHtmlBytes: 128000, heavyScriptHint: false, heavyImageHint: false },
  headers: {
    'content-encoding': 'br',
    'strict-transport-security': 'max-age=31536000',
    'x-frame-options': 'SAMEORIGIN',
    'x-content-type-options': 'nosniff',
  },
};

const brokenWordPress = {
  ...site,
  isHttps: false,
  finalUrl: 'http://x.de/',
  siteLang: '',
  cms: { type: 'wordpress', signals: [], wp: { version: '6.4.2', xmlrpc: true, usersExposed: true } },
  meta: { ...site.meta, title: '', titleLen: 0, description: '', descriptionLen: 0, robotsMeta: 'noindex', hasCanonical: false, hasJsonLd: false, hasOgTitle: false },
  dom: { h1Count: 0, imgCount: 80, scriptCount: 30 },
  accessibility: { imgMissingAlt: 60, imgWithoutAltRatio: 0.75 },
  perfHints: { approxHtmlBytes: 400000, heavyScriptHint: true, heavyImageHint: true },
  headers: { server: 'Apache/2.4.1', 'x-powered-by': 'PHP/8.1.2' },
};

const ids = (pre: unknown) => evaluatePageScan(pre).issues.map((i) => `${i.id}:${i.severity}`).sort();

// Same issues, ids and severities the scan reported before it moved onto the engine.
test('a healthy page reports exactly the old scan issues', () => {
  assert.deepEqual(ids(site), [
    'perf-no-cache-header:low',
    'sec-csp:medium',
    'sec-referrer-policy:low',
    'seo-h1-multiple:low',
    'seo-og-missing:low',
  ]);
});

test('a broken WordPress page reports exactly the old scan issues', () => {
  assert.deepEqual(ids(brokenWordPress), [
    'a11y-heading-structure:low',
    'a11y-img-alt:high',
    'a11y-lang-missing:medium',
    'perf-html-size:medium',
    'perf-image-count:medium',
    'perf-no-cache-header:low',
    'perf-no-compression:high',
    'perf-script-count:medium',
    'sec-csp:medium',
    'sec-frame-options:medium',
    'sec-no-https:high',
    'sec-nosniff:medium',
    'sec-referrer-policy:low',
    'sec-version-disclosure:low',
    'sec-wp-user-enum:medium',
    'sec-wp-version-exposed:low',
    'sec-wp-xmlrpc:medium',
    'seo-canonical-missing:medium',
    'seo-h1-missing:medium',
    'seo-meta-desc-missing:high',
    'seo-noindex:high',
    'seo-og-missing:low',
    'seo-schema-missing:medium',
    'seo-title-missing:high',
  ]);
});

test('fixable issues keep the flags the fix planner relies on', () => {
  const byId = new Map(evaluatePageScan(brokenWordPress).issues.map((i) => [i.id, i]));
  assert.equal(byId.get('seo-schema-missing')?.fixAvailable, true);
  assert.equal(byId.get('sec-wp-xmlrpc')?.estTokens, 400);
  assert.equal(byId.get('sec-wp-user-enum')?.fixAvailable, true);
  assert.equal(byId.get('sec-csp')?.fixAvailable, false);
});

test('Lighthouse is blended 60/40 except for security', () => {
  const scores = blendCategoryScores(
    { seo: 90, performance: 80, accessibility: 100, security: 70 },
    { seo: 100, performance: 50 },
  );
  assert.deepEqual(scores, { seo: 96, performance: 62, accessibility: 100, security: 70 });
  assert.equal(blendCategoryScores({ seo: null, performance: null, accessibility: null, security: null }, { seo: 88 }).seo, 88);
});

test('card insights come from the same checks as the scan', () => {
  const cards = evaluatePageCards(site);
  const scan = evaluatePageScan(site);
  for (const category of ['seo', 'security', 'accessibility', 'performance'] as const) {
    const problems = cards.findings.filter((f) => f.category === category && (f.status === 'fail' || f.status === 'warn'));
    assert.equal(problems.length, scan.issues.filter((i) => i.category === category).length, category);
    assert.equal(cards.insights[category].criticalIssues + cards.insights[category].warnings, problems.length);
  }
  // CSP is medium everywhere now: a warning, not a critical issue.
  assert.equal(cards.insights.security.criticalIssues, 0);
  assert.deepEqual(cards.insights.security.topIssues, ['No Content-Security-Policy', 'No Referrer-Policy']);
  assert.equal(cards.insights.security.topFindings[0].messages?.title, 'sec-csp.title');
  assert.equal(cards.overall, Math.round((cards.scores.seo + cards.scores.security + cards.scores.accessibility + cards.scores.performance) / 4));
});

test('exposure checks use what the public page showed, not connector telemetry', () => {
  const connected = {
    ...site,
    // analyze-facts for a connected site: cms comes from the connector, publicCms from the page.
    cms: { type: 'wordpress', wp: { version: '7.1.4', jsonApi: true, xmlrpc: null } },
    publicCms: { type: 'wordpress', signals: [], wp: { version: null, xmlrpc: null, usersExposed: false } },
  };
  const byId = new Map(evaluatePageCards(connected).findings.map((f) => [f.id, f]));
  assert.equal(byId.get('sec-wp-version-exposed')?.status, 'pass');
  assert.equal(byId.get('sec-wp-user-enum')?.status, 'pass');
});

test('missing title and description lower the Content score below badly sized ones', () => {
  const sized = { ...site, meta: { ...site.meta, title: 'Short title', titleLen: 11, description: 'Short', descriptionLen: 5 } };
  const empty = { ...site, meta: { ...site.meta, title: '', titleLen: 0, description: '', descriptionLen: 0 } };
  const sizedScore = evaluatePageCards(sized).scores.content;
  const emptyScore = evaluatePageCards(empty).scores.content;
  assert.ok(emptyScore < sizedScore, `${emptyScore} should be below ${sizedScore}`);
  assert.equal(evaluatePageCards(empty).insights.content.criticalIssues + evaluatePageCards(empty).insights.content.warnings, 2);
});
