import assert from 'node:assert/strict';
import test from 'node:test';

import { toCrawlPage, type SeoCrawl } from '@/lib/engine/seo/facts';
import { parseSeoPage } from '@/lib/engine/seo/page';
import { evaluateSeoGeo } from '@/lib/engine/seo/report';
import type { SeoFinding } from '@/lib/db/schema/ai/analysis';
import { acceptJudgement, buildAuditInput, computeMasterScore, crawledPageText, findingBasis, measuredToSeoFindings } from './audit';

const crawl: SeoCrawl = {
  origin: 'https://example.com',
  checkedAt: '2026-11-14T00:00:00.000Z',
  robots: { status: 'ok', text: 'User-agent: *\nAllow: /', contentType: 'text/plain' },
  llms: { status: 'missing', text: null, contentType: null },
  sitemap: { status: 'error', url: null, urlCount: 0, listedInRobots: false, hasLastmod: false },
  pages: [
    toCrawlPage(parseSeoPage('<html><head><title>Home</title></head><body><main><h1>Bakery</h1><p>Family bakery since 1952 in Berlin.</p></main></body></html>', 'https://example.com/'), false, true),
    toCrawlPage(parseSeoPage('<html><head><title>About</title></head><body><main><h1>About</h1><p>We bake.</p></main></body></html>', 'https://example.com/about/'), false, false),
  ],
  pageErrors: 0,
};

test('measured checks become audit findings; unknown ones are left out', () => {
  const report = evaluateSeoGeo(crawl);
  const findings = measuredToSeoFindings(report.findings);
  const byId = new Map(findings.map((f) => [f.id, f]));
  assert.ok(!byId.has('seo-xml-sitemap'), 'an unobserved sitemap is not reported as missing');
  assert.equal(byId.get('geo-llms-txt')!.section, 'llms-txt');
  assert.equal(byId.get('geo-llms-txt')!.score, 3, 'warnings stay below the "passed" threshold of 4');
  assert.equal(byId.get('geo-ai-search-access')!.passed, true);
  assert.equal(byId.get('geo-organization-schema')!.score, 2, 'a medium failure');
  assert.equal(byId.get('seo-page-titles')!.section, 'technical-seo');
  assert.ok(findings.every((f) => f.basis === 'measured'));
  assert.equal(findingBasis('seo-page-titles'), 'measured');
  assert.equal(findingBasis('ai-clear-offer'), 'estimated');
  assert.equal(findingBasis('https-ok'), undefined, 'audits from before the split stay unlabelled');
});

test('the AI sees measured results and page excerpts, nothing else', () => {
  const input = buildAuditInput(crawl, evaluateSeoGeo(crawl).findings);
  assert.deepEqual(input.pages.map((p) => p.path), ['/', '/about/']);
  assert.match(input.pages[0].excerpt, /Family bakery since 1952/);
  assert.ok(input.measuredChecks.some((c) => c.id === 'geo-llms-txt' && c.status === 'warn'));
});

test('AI findings must cite a crawled page, stay in judgement sections and never shadow a measured id', () => {
  const paths = crawledPageText(crawl);
  const used = new Set<string>(['geo-llms-txt']);
  const base = { type: 'finding', id: 'clear-offer', section: 'ai-seo', title: 'Offer is clear', severity: 'low', score: 5, passed: true, impact: 'Good.', evidence: '/: "Family bakery since 1952"', automatedFix: { type: 'manual', description: 'None', effort: 'low' } };

  const ok = acceptJudgement(base, paths, used)!;
  assert.equal(ok.id, 'ai-clear-offer');
  assert.equal(ok.basis, 'estimated');
  assert.equal(ok.automatedFix.evidence, '/: "Family bakery since 1952"');

  assert.equal(acceptJudgement({ ...base, evidence: '/pricing/: "x"' }, paths, used), null, 'a page that was not crawled');
  assert.equal(acceptJudgement({ ...base, evidence: undefined }, paths, used), null, 'no evidence');
  assert.equal(acceptJudgement({ ...base, evidence: '/' }, paths, used), null, 'a path without a quote');
  assert.equal(acceptJudgement({ ...base, evidence: '/: "Completely invented quote"' }, paths, used), null, 'a quote not on the page');
  assert.equal(acceptJudgement({ ...base, evidence: '/about/: "Family bakery since 1952"' }, paths, used), null, 'a quote from another page');
  assert.equal(acceptJudgement({ ...base, evidence: '/: "bakery"' }, paths, used), null, 'too short to prove anything');
  assert.ok(acceptJudgement({ ...base, id: 'loose', evidence: '/: \u201cfamily  BAKERY since 1952 in\u2026\u201d' }, paths, used), 'case, spacing, curly quotes and an ellipsis are tolerated');
  assert.equal(acceptJudgement({ ...base, section: 'technical-seo' }, paths, used), null, 'measured-only section');
  assert.equal(acceptJudgement({ ...base, section: 'llms-txt' }, paths, used), null, 'measured-only section');

  const again = acceptJudgement(base, paths, used)!;
  assert.equal(again.id, 'ai-clear-offer-x', 'ids stay unique');

  const problem = acceptJudgement({ ...base, id: 'thin', passed: false, score: 5, severity: 'bogus' }, paths, used)!;
  assert.equal(problem.score, 3, 'a problem cannot score as passed');
  assert.equal(problem.severity, 'medium');
});

test('sections without findings do not count against the master score', () => {
  const f = (section: SeoFinding['section'], score: number): SeoFinding => ({
    id: `${section}-${score}`, section, title: 't', severity: 'low', score, impact: '', automatedFix: { type: 'manual', description: '', effort: 'low' },
  });
  const score = computeMasterScore([f('technical-seo', 5), f('content-eeat', 5), f('geo', 5), f('llms-txt', 5)], 0, 'm', 'p');
  assert.equal(score.master, 100, 'AI analytics (not measured) and empty sections are left out');
  assert.equal(score.aiAnalytics, 0);
  const half = computeMasterScore([f('technical-seo', 5), f('geo', 0)], 0, 'm', 'p');
  assert.equal(half.master, 50);
  assert.equal(computeMasterScore([], 0, 'm', 'p').master, 0);
});
