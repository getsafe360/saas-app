import assert from 'node:assert/strict';
import test from 'node:test';

import { toCrawlPage, type SeoCrawl } from '@/lib/engine/seo/facts';
import { parseSeoPage } from '@/lib/engine/seo/page';
import { evaluateSeoGeo } from '@/lib/engine/seo/report';
import { buildLlmsTxt, siteNameFrom } from '@/lib/seo/llms';
import { createWordPressActionPlan } from '@/lib/wordpress/plan';
import { parseRollbackRequest } from '@/lib/wordpress/rollback';
import type { WordPressCapabilitySummary, WordPressSeoEnvironment } from '@/lib/wordpress/types';
import { AUTOMATIC_FIXER_IDS, fixModeFor } from './catalog';
import { AI_CRAWLERS } from '@/lib/engine/seo/robots';
import { aiSearchAccessFixer, llmsTxtFixer, siteSchemaFixer } from './wordpress/geo';

const page = (html: string, url: string, inSitemap: boolean, isHome: boolean) => toCrawlPage(parseSeoPage(html, url), inSitemap, isHome);

const crawl = (robots: string): SeoCrawl => ({
  origin: 'https://bakery.example',
  checkedAt: '2026-11-14T00:00:00.000Z',
  robots: { status: 'ok', text: robots, contentType: 'text/plain' },
  llms: { status: 'missing', text: null, contentType: null },
  sitemap: { status: 'ok', url: 'https://bakery.example/sitemap.xml', urlCount: 3, listedInRobots: true, hasLastmod: true },
  pages: [
    page('<html><head><title>Home | Bakery Müller</title><meta name="description" content="Family bakery in Berlin since 1952."></head><body><main><h1>Bakery</h1></main></body></html>', 'https://bakery.example/', true, true),
    page('<html><head><title>Opening hours [new] | Bakery Müller</title><meta name="description" content="Open daily from 7 am."></head><body></body></html>', 'https://bakery.example/hours/', false, false),
    page('<html><head><title>Cakes | Bakery Müller</title></head><body></body></html>', 'https://bakery.example/cakes/', true, false),
    page('<html><head><title>Thanks</title><meta name="robots" content="noindex"></head><body></body></html>', 'https://bakery.example/thanks/', false, false),
  ],
  pageErrors: 0,
});

const seo = (overrides: Partial<WordPressSeoEnvironment> = {}): WordPressSeoEnvironment => ({
  seoPlugin: null, rootInstall: true, robotsFile: false, llmsFile: false, searchVisible: true,
  staticHomePage: true, llmsTxt: false, aiCrawlerRules: {}, schemaTypes: [], ...overrides,
});

const caps = (raw: Record<string, boolean>): WordPressCapabilitySummary => ({
  read: true, write: true, themeFiles: false, mediaUpload: false, pageUpdate: false, rollback: true, raw,
});

const OPEN = 'User-agent: *\nDisallow: /wp-admin/\n';
// Everyone but Google and Bing is kept out by the `*` group, which the connector can add groups next to.
const BLOCKS_AI = 'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nUser-agent: Bingbot\nAllow: /\n';
// Another plugin wrote its own groups for these crawlers: theirs, not the connector's.
const OTHERS_BLOCK_AI = 'User-agent: *\nDisallow: /wp-admin/\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\n';

test('llms.txt: site name, summary, indexable pages with their own titles', () => {
  const text = buildLlmsTxt(crawl(OPEN))!;
  const lines = text.split('\n');
  assert.equal(lines[0], '# Bakery Müller');
  assert.equal(lines[2], '> Family bakery in Berlin since 1952.');
  assert.ok(text.includes('- [Bakery Müller: home](https://bakery.example/): Family bakery in Berlin since 1952.'));
  assert.ok(text.includes('- [Opening hours new](https://bakery.example/hours/): Open daily from 7 am.'), 'brackets dropped, site name suffix removed');
  assert.ok(text.indexOf('/cakes/') < text.indexOf('/hours/'), 'sitemap pages first');
  assert.ok(!text.includes('/thanks/'), 'noindex pages left out');
  assert.equal(siteNameFrom(undefined, 'https://www.bakery.example'), 'bakery.example');
});

test('llms.txt fixer plans only where the site can serve it', () => {
  const findings = [{ id: 'geo-llms-txt', actionId: 'geo-llms-txt' }];
  const plan = llmsTxtFixer.plan(findings, { crawl: crawl(OPEN), seo: seo() });
  assert.equal(plan?.type, 'set_llms_txt');
  assert.match(String(plan?.payload.content), /^# Bakery Müller\n/);
  assert.equal(llmsTxtFixer.plan(findings, { crawl: crawl(OPEN), seo: seo({ llmsFile: true }) }), null, 'a real file wins');
  assert.equal(llmsTxtFixer.plan(findings, { crawl: crawl(OPEN), seo: seo({ rootInstall: false }) }), null, 'subfolder install');
  assert.equal(llmsTxtFixer.plan(findings, { crawl: null, seo: seo() }), null, 'no crawl, nothing to write');
});

test('AI search access: allows the blocked search crawlers only, never against a site that blocks search', () => {
  const findings = [{ id: 'geo-ai-search-access', actionId: 'geo-ai-search-access' }];
  const plan = aiSearchAccessFixer.plan(findings, { crawl: crawl(BLOCKS_AI), seo: seo() });
  const searchBots = AI_CRAWLERS.filter((bot) => bot.purpose === 'search').map((bot) => bot.agent);
  assert.deepEqual(Object.keys(plan?.payload.rules as object).sort(), [...searchBots].sort(), 'search crawlers only, no training crawlers');
  assert.equal(aiSearchAccessFixer.plan(findings, { crawl: crawl(OTHERS_BLOCK_AI), seo: seo() }), null, 'groups another plugin wrote stay guided');
  const own = aiSearchAccessFixer.plan(findings, { crawl: crawl(OTHERS_BLOCK_AI), seo: seo({ aiCrawlerRules: { 'OAI-SearchBot': 'block' } }) });
  assert.deepEqual(own?.payload.rules, { 'OAI-SearchBot': 'allow' }, 'the connector may change its own block');
  assert.equal(aiSearchAccessFixer.plan(findings, { crawl: crawl('User-agent: *\nDisallow: /\n'), seo: seo() }), null, 'Google blocked too: a decision');
  assert.equal(aiSearchAccessFixer.plan(findings, { crawl: crawl(BLOCKS_AI), seo: seo({ robotsFile: true }) }), null, 'physical robots.txt');
  assert.equal(aiSearchAccessFixer.plan(findings, { crawl: crawl(BLOCKS_AI), seo: seo({ searchVisible: false }) }), null, 'discouraged');
  assert.equal(aiSearchAccessFixer.plan(findings, { crawl: crawl(OPEN), seo: seo() }), null, 'nothing blocked');

  const request = aiSearchAccessFixer.toConnectorRequest({
    id: 'geo-ai-search-access', type: 'set_ai_crawler_rules', title: '', description: '', risk: 'low',
    autoApplyEligible: true, requiresApproval: false, requiredCapabilities: [], verification: { kind: 'api', expectation: '' },
    payload: { rules: { 'OAI-SearchBot': 'allow', EvilBot: 'allow', GPTBot: 'block' } },
  });
  assert.deepEqual(request?.payload, { rules: { 'OAI-SearchBot': 'allow' } }, 'only known crawlers, only allow');
});

test('site schema: one action for both findings, none next to an SEO plugin', () => {
  const findings = [
    { id: 'geo-organization-schema', actionId: 'geo-site-schema' },
    { id: 'geo-website-schema', actionId: 'geo-site-schema' },
  ];
  assert.deepEqual(siteSchemaFixer.plan(findings, { seo: seo() })?.payload.types, ['Organization', 'WebSite']);
  assert.equal(siteSchemaFixer.plan(findings, { seo: seo({ seoPlugin: 'yoast' }) }), null);
  const onlyOrg = siteSchemaFixer.plan([findings[0]], { seo: seo({ schemaTypes: ['WebSite'] }) });
  assert.deepEqual(onlyOrg?.payload.types, ['Organization', 'WebSite'], 'types the connector already adds are kept');
});

test('measured findings route to the GEO fixers and plan through the connector', () => {
  const site = crawl(BLOCKS_AI);
  const findings = evaluateSeoGeo(site).findings.filter((f) => f.fix && (f.status === 'fail' || f.status === 'warn'));
  assert.deepEqual(findings.map((f) => f.fix!.fixerId).sort(), ['geo-ai-search-access', 'geo-llms-txt', 'geo-site-schema', 'geo-site-schema']);
  assert.ok(findings.every((f) => fixModeFor(f.fix!.fixerId, f.fix!.automation) === 'automatic' && AUTOMATIC_FIXER_IDS.has(f.fix!.fixerId)));

  const plan = createWordPressActionPlan({
    siteId: 's',
    findings: findings.map((f) => ({ id: f.id, actionId: f.fix!.fixerId, title: f.title })),
    capabilities: caps({ llmsTxt: true, aiCrawlerRules: true, schemaGaps: true }),
    context: { crawl: site, seo: seo() },
  });
  assert.deepEqual(plan.actions.map((a) => a.type).sort(), ['set_ai_crawler_rules', 'set_llms_txt', 'set_schema']);
  assert.ok(plan.actions.every((a) => a.autoApplyEligible));

  // An older connector: planned, but blocked with a reason instead of a silent guided review.
  const old = createWordPressActionPlan({
    siteId: 's', findings: [{ id: 'geo-llms-txt', actionId: 'geo-llms-txt' }], capabilities: caps({}), context: { crawl: site, seo: null },
  });
  assert.equal(old.actions[0].autoApplyEligible, false);
  assert.match(old.actions[0].description, /connector 1\.12 or newer/);
});

test('undo requests the connector returns for GEO fixes are accepted, others are not', () => {
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_llms_txt', payload: { content: null } })?.payload, { content: null });
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_ai_crawler_rules', payload: { rules: { GPTBot: null, 'OAI-SearchBot': 'block' } } })?.payload, { rules: { GPTBot: null, 'OAI-SearchBot': 'block' } });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_ai_crawler_rules', payload: { rules: { '*': 'allow' } } }), null);
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_schema', payload: { types: [] } })?.payload, { types: [], sameAs: [] });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_schema', payload: { types: ['Product'] } }), null);
  assert.deepEqual(parseRollbackRequest({ id: 'r', type: 'set_seo_meta', payload: { postId: 7, title: null, restore: true } })?.payload, { postId: 7, restore: true, title: null });
  assert.equal(parseRollbackRequest({ id: 'r', type: 'set_seo_meta', payload: { postId: 0, title: 'x' } }), null);
});

test('verification reads the live site', async () => {
  const fetchImpl = (async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/llms.txt') return new Response('# Bakery Müller\n', { status: 200 });
    if (path === '/robots.txt') return new Response(OPEN + '\nUser-agent: OAI-SearchBot\nAllow: /\n', { status: 200 });
    return new Response('<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"B"}]}</script></head></html>', { status: 200 });
  }) as typeof fetch;
  const action = (payload: Record<string, unknown>) => ({
    id: 'x', type: 'verify_render' as const, title: '', description: '', risk: 'low' as const, autoApplyEligible: true,
    requiresApproval: false, requiredCapabilities: [], verification: { kind: 'api' as const, expectation: '' }, payload,
  });
  const ctx = (payload: Record<string, unknown>) => ({ siteUrl: 'https://bakery.example', tokenHash: 't', action: action(payload), fetchImpl });
  assert.equal((await llmsTxtFixer.verify(ctx({}))).success, true);
  assert.equal((await aiSearchAccessFixer.verify(ctx({ rules: { 'OAI-SearchBot': 'allow' } }))).success, true);
  const schema = await siteSchemaFixer.verify(ctx({ types: ['Organization', 'WebSite'] }));
  assert.equal(schema.success, false, 'WebSite missing');
  assert.deepEqual(schema.checks.map((c) => c.ok), [true, false]);
});
