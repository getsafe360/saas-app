import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRules } from '../rules';
import { toCrawlPage, type SeoCrawl } from './facts';
import { parseSeoPage } from './page';
import { isAllowed, parseRobots } from './robots';
import { SEO_GEO_RULES } from './rules';

test('robots.txt: most specific group, longest rule, allow wins ties', () => {
  const robots = parseRobots(`
# comment
User-agent: *
Disallow: /private/
Allow: /private/press/

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow:

Sitemap: https://example.com/sitemap.xml
`);
  assert.deepEqual(robots.sitemaps, ['https://example.com/sitemap.xml']);
  assert.equal(isAllowed(robots, 'Googlebot', '/'), true);
  assert.equal(isAllowed(robots, 'Googlebot', '/private/x'), false);
  assert.equal(isAllowed(robots, 'Googlebot', '/private/press/a'), true);
  assert.equal(isAllowed(robots, 'gptbot', '/'), false, 'agent names match case-insensitively');
  assert.equal(isAllowed(robots, 'CCBot', '/'), false, 'consecutive user-agent lines share a group');
  assert.equal(isAllowed(robots, 'PerplexityBot', '/private/x'), true, 'a named group replaces the * group');
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /*.pdf$'), 'Bingbot', '/a.pdf'), false);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /*.pdf$'), 'Bingbot', '/a.pdf?x'), true);
  assert.equal(isAllowed(parseRobots('Disallow: /'), 'Bingbot', '/'), true, 'rules outside a group are ignored');
});

const HTML = `<!doctype html><html lang="de"><head>
<title>Bäckerei Muster – Brot aus Berlin</title>
<meta name="description" content="Frisches Brot jeden Tag.">
<link rel="canonical" href="/">
<meta property="og:title" content="Bäckerei Muster"><meta property="og:image" content="/og.jpg">
<link rel="alternate" hreflang="de" href="/"><link rel="alternate" hreflang="en" href="/en/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Bakery","name":"Muster"},{"@type":"WebSite","url":"/"},{"@type":"BlogPosting","author":{"@type":"Person","name":"Ada"},"datePublished":"2026-01-02","dateModified":"2026-03-04"}]}</script>
<script type="application/ld+json">{ broken </script>
</head><body><nav><a href="/menu/">Menu</a></nav><main>
<h1>Brot aus Berlin</h1><h2>Wann öffnen Sie?</h2><p>Wir backen jeden Morgen frisches Brot für Berlin.</p>
<img src="a.jpg"><img src="b.jpg" alt="">
<a href="/about/">About</a><a href="https://www.example.com/x#y">X</a><a href="https://other.org/">Other</a><a href="mailto:a@b.c">Mail</a>
</main><script>var words = "not counted";</script></body></html>`;

test('page parser reads titles, schema, dates, author, links and words', () => {
  const page = parseSeoPage(HTML, 'https://example.com/');
  assert.equal(page.title, 'Bäckerei Muster – Brot aus Berlin');
  assert.equal(page.description, 'Frisches Brot jeden Tag.');
  assert.equal(page.canonical, 'https://example.com/');
  assert.equal(page.lang, 'de');
  assert.deepEqual(page.hreflang, ['de', 'en']);
  assert.deepEqual(page.h1, ['Brot aus Berlin']);
  assert.equal(page.questionHeadings, 1);
  assert.deepEqual(page.og, { title: true, description: false, image: true });
  assert.deepEqual(page.schema.types, ['Bakery', 'BlogPosting', 'Person', 'WebSite']);
  assert.equal(page.schema.invalidBlocks, 1);
  assert.deepEqual(page.schema.businessTypes, []);
  assert.deepEqual(page.schema.articles, [{ type: 'BlogPosting', hasAuthor: true, hasDatePublished: true, hasDateModified: true }]);
  assert.equal(page.modifiedAt, '2026-03-04T00:00:00.000Z');
  assert.equal(page.hasAuthor, true);
  assert.deepEqual(page.internalLinks.sort(), ['https://example.com/about/', 'https://example.com/menu/', 'https://www.example.com/x']);
  assert.equal(page.images, 2);
  assert.equal(page.imagesWithoutAlt, 1, 'an empty alt is a deliberate decorative image');
  assert.ok(page.wordCount >= 8 && page.wordCount <= 20, `main text only, got ${page.wordCount}`);

  const themed = parseSeoPage('<html><body><header><time datetime="2030-01-01">x</time></header><main><time datetime="2026-05-06T08:00:00+02:00">6 May</time></main></body></html>', 'https://example.com/p/');
  assert.equal(themed.modifiedAt, '2026-05-06T06:00:00.000Z', 'dates in the content count, header widgets do not');
});

function crawl(overrides: Partial<SeoCrawl> = {}): SeoCrawl {
  const home = toCrawlPage(parseSeoPage(HTML, 'https://example.com/'), true, true);
  const inner = toCrawlPage(
    parseSeoPage('<html><head><title>Bäckerei Muster – Brot aus Berlin</title><meta name="robots" content="noindex"></head><body><h1>A</h1><h1>B</h1></body></html>', 'https://example.com/old/'),
    true,
    false,
  );
  return {
    origin: 'https://example.com',
    checkedAt: '2026-11-14T00:00:00.000Z',
    robots: { status: 'ok', text: 'User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /', contentType: 'text/plain' },
    llms: { status: 'missing', text: null, contentType: null },
    sitemap: { status: 'ok', url: 'https://example.com/sitemap.xml', urlCount: 12, listedInRobots: false, hasLastmod: true },
    pages: [home, inner],
    pageErrors: 0,
    ...overrides,
  };
}

const byId = (c: SeoCrawl) => new Map(evaluateRules(SEO_GEO_RULES, c).map((f) => [f.id, f]));

test('GEO rules: AI search access, training choice, llms.txt, schema, freshness', () => {
  const f = byId(crawl());
  assert.equal(f.get('geo-ai-search-access')!.status, 'fail');
  assert.equal(f.get('geo-ai-search-access')!.evidence?.observed, 'OAI-SearchBot (OpenAI)');
  assert.equal(f.get('geo-ai-training-access')!.status, 'pass', 'blocking training is a choice, never a fault');
  assert.match(f.get('geo-ai-training-access')!.summary, /GPTBot/);
  assert.equal(f.get('geo-llms-txt')!.status, 'warn');
  assert.equal(f.get('geo-organization-schema')!.status, 'pass', 'Bakery counts as a business type');
  assert.equal(f.get('geo-website-schema')!.status, 'pass');
  assert.equal(f.get('geo-author-signals')!.status, 'pass');
  assert.equal(f.get('geo-content-freshness')!.status, 'pass');
  assert.equal(f.get('geo-answer-structure')!.status, 'pass');

  const stale = byId(crawl({ checkedAt: '2027-06-01T00:00:00.000Z' }));
  assert.equal(stale.get('geo-content-freshness')!.status, 'warn');

  const custom = toCrawlPage(parseSeoPage('<html><head><script type="application/ld+json">{"@type":"TattooParlor","name":"Ink","telephone":"+49 30 1"}</script></head><body></body></html>', 'https://example.com/'), true, true);
  assert.equal(byId(crawl({ pages: [custom] })).get('geo-organization-schema')!.status, 'pass', 'any type with business details counts');

  const llms = byId(crawl({ llms: { status: 'ok', text: '# Bäckerei Muster\n\n- [Menu](https://example.com/menu/)', contentType: 'text/plain' } }));
  assert.equal(llms.get('geo-llms-txt')!.status, 'pass');
});

test('SEO rules: sitemap, noindex conflicts, duplicates, broken schema, hreflang', () => {
  const f = byId(crawl());
  assert.equal(f.get('seo-robots-txt')!.status, 'pass');
  assert.equal(f.get('seo-xml-sitemap')!.status, 'pass');
  assert.equal(f.get('seo-sitemap-in-robots')!.status, 'warn');
  assert.equal(f.get('seo-noindex-in-sitemap')!.status, 'fail');
  assert.equal(f.get('seo-noindex-in-sitemap')!.evidence?.observed, '/old/');
  assert.equal(f.get('seo-page-titles')!.status, 'warn', 'the two pages share a title');
  assert.equal(f.get('seo-page-h1')!.status, 'warn');
  assert.equal(f.get('seo-schema-invalid')!.status, 'fail');
  assert.equal(f.get('seo-hreflang')!.status, 'warn', 'no x-default');

  const blocked = byId(crawl({ robots: { status: 'ok', text: 'User-agent: *\nDisallow: /', contentType: 'text/plain' } }));
  assert.equal(blocked.get('seo-robots-txt')!.status, 'fail');
  assert.equal(blocked.get('seo-robots-txt')!.severity, 'critical');
});

test('nothing observed means unknown, never a guess', () => {
  const f = byId(crawl({ robots: { status: 'error', text: null, contentType: null }, pages: [], pageErrors: 3 }));
  for (const id of ['geo-ai-search-access', 'geo-ai-training-access', 'seo-robots-txt', 'geo-organization-schema', 'seo-page-titles']) {
    assert.equal(f.get(id)!.status, 'unknown', id);
  }
  // The homepage failed but an inner page was read: homepage checks stay unknown, the inner page still counts.
  const inner = toCrawlPage(parseSeoPage('<html><head><script type="application/ld+json">{"@type":"WebSite"}</script></head><body><main>Kurz.</main></body></html>', 'https://example.com/kontakt/'), true, false);
  const noHome = byId(crawl({ pages: [inner], pageErrors: 1 }));
  assert.equal(noHome.get('geo-website-schema')!.status, 'unknown', 'an inner page is not judged as the homepage');
  assert.equal(noHome.get('geo-thin-content')!.status, 'warn', 'the inner page still counts');

  // A sitemap that timed out is not a missing sitemap.
  const sitemapDown = byId(crawl({ sitemap: { status: 'error', url: null, urlCount: 0, listedInRobots: false, hasLastmod: false } }));
  for (const id of ['seo-xml-sitemap', 'seo-sitemap-in-robots', 'seo-noindex-in-sitemap']) {
    assert.equal(sitemapDown.get(id)!.status, 'unknown', id);
  }

  const noRobots = byId(crawl({ robots: { status: 'missing', text: null, contentType: null } }));
  assert.equal(noRobots.get('geo-ai-search-access')!.status, 'pass');
  assert.equal(noRobots.get('seo-robots-txt')!.status, 'warn');
});
