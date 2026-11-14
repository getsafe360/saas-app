// lib/engine/seo/rules.ts
//
// Site-level SEO and GEO (AI search) checks over a crawl: what robots.txt lets
// search and AI crawlers read, llms.txt, the sitemap, structured data, and
// what the crawled pages show (titles, descriptions, headings, canonicals,
// social tags, author and date signals). Ids starting with `geo-` are about AI
// answer engines, `seo-` about search engines. Text: messages/Findings.

import { type Rule, unknown } from '../rules';
import type { SeoCrawl, SeoCrawlPage } from './facts';
import { AI_CRAWLERS, isAllowed, parseRobots, SEARCH_CRAWLERS } from './robots';

const NO_PAGES = 'common.pageNotRead';
const NO_ROBOTS = 'common.robotsNotRead';

/** Path of a crawled URL for evidence lines ("/about/"). */
const pathOf = (url: string) => {
  try {
    const { pathname, search } = new URL(url);
    return pathname + search;
  } catch {
    return url;
  }
};
const listPaths = (pages: ReadonlyArray<SeoCrawlPage>, max = 5) =>
  pages.slice(0, max).map((page) => pathOf(page.url)).join(', ') + (pages.length > max ? ` (+${pages.length - max})` : '');

const robotsOf = (crawl: SeoCrawl) => (crawl.robots.status === 'ok' && crawl.robots.text !== null ? parseRobots(crawl.robots.text) : null);

/** Duplicate non-empty values: the pages that share one with another page. */
function sharing(pages: ReadonlyArray<SeoCrawlPage>, value: (page: SeoCrawlPage) => string): SeoCrawlPage[] {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const v = value(page).trim().toLowerCase();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return pages.filter((page) => (counts.get(value(page).trim().toLowerCase()) ?? 0) > 1);
}

/** Organization and the common LocalBusiness subtypes; any type that carries an address or phone also counts. */
const ORGANIZATION_TYPE =
  /(Organization|LocalBusiness|Corporation|NGO|Store|Shop|Restaurant|Bakery|CafeOrCoffeeShop|BarOrPub|Brewery|Winery|Hotel|Business|Service|Agency|Clinic|Physician|Dentist|Pharmacy|Optician|Attorney|Notary|Salon|HealthClub|Plumber|Electrician|Contractor|AutoRepair|AutoDealer|Florist|School|ChildCare|VeterinaryCare)$/;
const FAQ_TYPES = new Set(['FAQPage', 'QAPage']);
const STALE_DAYS = 365;
const THIN_WORDS = 300;

export const SEO_GEO_RULES: ReadonlyArray<Rule<SeoCrawl>> = [
  // ---------- GEO: AI answer engines ----------
  {
    id: 'geo-ai-search-access',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: (crawl) => {
      if (crawl.robots.status === 'error') return unknown(NO_ROBOTS);
      const robots = robotsOf(crawl);
      if (!robots) return { status: 'pass', message: 'noRobots' };
      const blocked = AI_CRAWLERS.filter((bot) => bot.purpose === 'search' && !isAllowed(robots, bot.agent));
      return blocked.length > 0
        ? { status: 'fail', message: 'blocked', values: { count: blocked.length, bots: blocked.map((b) => b.agent).join(', ') }, observed: blocked.map((b) => `${b.agent} (${b.owner})`).join(', ') }
        : { status: 'pass', message: 'allowed' };
    },
  },
  {
    id: 'geo-ai-training-access',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    // A choice, not a fault: training crawlers are shown so the owner decides knowingly.
    evaluate: (crawl) => {
      if (crawl.robots.status === 'error') return unknown(NO_ROBOTS);
      const robots = robotsOf(crawl);
      const training = AI_CRAWLERS.filter((bot) => bot.purpose === 'training');
      const blocked = robots ? training.filter((bot) => !isAllowed(robots, bot.agent)) : [];
      return blocked.length === 0
        ? { status: 'pass', message: 'allAllowed' }
        : { status: 'pass', message: 'someBlocked', values: { count: blocked.length, bots: blocked.map((b) => b.agent).join(', ') }, observed: blocked.map((b) => b.agent).join(', ') };
    },
  },
  {
    id: 'geo-llms-txt',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ llms }) => {
      if (llms.status === 'error') return unknown('common.notEvaluated');
      if (llms.status === 'missing' || !llms.text) return { status: 'warn', message: 'missing' };
      const text = llms.text.trim();
      const hasTitle = /^#\s+\S/.test(text);
      const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
      return hasTitle && links > 0
        ? { status: 'pass', message: 'present', values: { links }, observed: text.split('\n')[0].slice(0, 120) }
        : { status: 'warn', message: 'invalid', observed: text.slice(0, 120) };
    },
  },
  {
    id: 'geo-organization-schema',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const found = pages.flatMap((page) => [
        ...page.schema.types.filter((type) => ORGANIZATION_TYPE.test(type)),
        ...page.schema.businessTypes,
      ]);
      return found.length > 0
        ? { status: 'pass', message: 'present', values: { type: found[0] }, observed: [...new Set(found)].join(', ') }
        : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'geo-website-schema',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      const home = pages.find((page) => page.isHome);
      if (!home) return unknown(NO_PAGES);
      return home.schema.types.includes('WebSite') ? { status: 'pass', message: 'present' } : { status: 'warn', message: 'missing' };
    },
  },
  {
    id: 'geo-author-signals',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const articles = pages.filter((page) => page.schema.articles.length > 0);
      if (articles.length === 0) return { status: 'not-applicable', message: 'noArticles' };
      const without = articles.filter((page) => !page.hasAuthor);
      return without.length === 0
        ? { status: 'pass', message: 'present', values: { count: articles.length } }
        : { status: 'warn', message: 'missing', values: { count: without.length, total: articles.length }, observed: listPaths(without) };
    },
  },
  {
    id: 'geo-content-freshness',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages, checkedAt }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const dated = pages.filter((page) => page.modifiedAt);
      if (dated.length === 0) return { status: 'warn', message: 'noDates', severity: 'low' };
      const newest = Math.max(...dated.map((page) => Date.parse(page.modifiedAt as string)));
      const days = Math.floor((Date.parse(checkedAt) - newest) / 86_400_000);
      return days > STALE_DAYS
        ? { status: 'warn', message: 'stale', values: { days }, observed: new Date(newest).toISOString().slice(0, 10) }
        : { status: 'pass', message: 'fresh', values: { days: Math.max(0, days) }, observed: new Date(newest).toISOString().slice(0, 10) };
    },
  },
  {
    id: 'geo-answer-structure',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const withFaq = pages.filter((page) => page.schema.types.some((type) => FAQ_TYPES.has(type)));
      const withQuestions = pages.filter((page) => page.questionHeadings > 0);
      if (withFaq.length > 0) return { status: 'pass', message: 'faq', values: { count: withFaq.length }, observed: listPaths(withFaq) };
      if (withQuestions.length > 0) return { status: 'pass', message: 'questions', values: { count: withQuestions.length }, observed: listPaths(withQuestions) };
      return { status: 'warn', message: 'none' };
    },
  },
  {
    id: 'geo-thin-content',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      const inner = pages.filter((page) => !page.isHome && !page.noindex);
      if (inner.length === 0) return pages.length === 0 ? unknown(NO_PAGES) : { status: 'not-applicable', message: 'onlyHome' };
      const thin = inner.filter((page) => page.wordCount < THIN_WORDS);
      // Contact and legal pages are short by nature; flag only when thin pages dominate.
      return thin.length * 2 > inner.length
        ? { status: 'warn', message: 'thin', values: { count: thin.length, total: inner.length, words: THIN_WORDS }, observed: listPaths(thin) }
        : { status: 'pass', message: 'ok', values: { total: inner.length } };
    },
  },

  // ---------- SEO: search engines ----------
  {
    id: 'seo-robots-txt',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: (crawl) => {
      if (crawl.robots.status === 'error') return unknown(NO_ROBOTS);
      if (crawl.robots.status === 'missing') return { status: 'warn', message: 'missing' };
      const robots = robotsOf(crawl)!;
      const blocked = SEARCH_CRAWLERS.filter((agent) => !isAllowed(robots, agent));
      return blocked.length > 0
        ? { status: 'fail', message: 'blocksSearch', severity: 'critical', values: { bots: blocked.join(', ') }, observed: blocked.join(', ') }
        : { status: 'pass', message: 'ok' };
    },
  },
  {
    id: 'seo-xml-sitemap',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ sitemap }) => {
      if (sitemap.status === 'error') return unknown('common.notEvaluated');
      return sitemap.status === 'ok'
        ? { status: 'pass', message: 'present', values: { count: sitemap.urlCount }, observed: sitemap.url ?? undefined }
        : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'seo-sitemap-in-robots',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ sitemap, robots }) => {
      if (sitemap.status === 'error') return unknown('common.notEvaluated');
      if (sitemap.status !== 'ok') return { status: 'not-applicable', message: 'noSitemap' };
      if (robots.status === 'error') return unknown(NO_ROBOTS);
      return sitemap.listedInRobots ? { status: 'pass', message: 'listed' } : { status: 'warn', message: 'notListed' };
    },
  },
  {
    id: 'seo-schema-invalid',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const broken = pages.filter((page) => page.schema.invalidBlocks > 0);
      return broken.length > 0
        ? { status: 'fail', message: 'invalid', values: { count: broken.length }, observed: listPaths(broken) }
        : { status: 'pass', message: 'valid' };
    },
  },
  {
    id: 'seo-page-titles',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const missing = pages.filter((page) => !page.title);
      const duplicate = sharing(pages, (page) => page.title);
      if (missing.length > 0) return { status: 'fail', message: 'missing', values: { count: missing.length, total: pages.length }, observed: listPaths(missing) };
      if (duplicate.length > 0) return { status: 'warn', message: 'duplicate', values: { count: duplicate.length, total: pages.length }, observed: listPaths(duplicate) };
      return { status: 'pass', message: 'ok', values: { total: pages.length } };
    },
  },
  {
    id: 'seo-page-descriptions',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const missing = pages.filter((page) => !page.description);
      const duplicate = sharing(pages, (page) => page.description);
      if (missing.length > 0) return { status: 'warn', message: 'missing', values: { count: missing.length, total: pages.length }, observed: listPaths(missing) };
      if (duplicate.length > 0) return { status: 'warn', message: 'duplicate', severity: 'low', values: { count: duplicate.length, total: pages.length }, observed: listPaths(duplicate) };
      return { status: 'pass', message: 'ok', values: { total: pages.length } };
    },
  },
  {
    id: 'seo-page-h1',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const off = pages.filter((page) => page.h1.length !== 1);
      return off.length > 0
        ? { status: 'warn', message: 'notOne', values: { count: off.length, total: pages.length }, observed: off.slice(0, 5).map((page) => `${pathOf(page.url)}: ${page.h1.length}`).join(', ') }
        : { status: 'pass', message: 'ok', values: { total: pages.length } };
    },
  },
  {
    id: 'seo-page-canonicals',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const missing = pages.filter((page) => !page.canonical);
      return missing.length > 0
        ? { status: 'warn', message: 'missing', values: { count: missing.length, total: pages.length }, observed: listPaths(missing) }
        : { status: 'pass', message: 'ok', values: { total: pages.length } };
    },
  },
  {
    id: 'seo-noindex-in-sitemap',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ pages, sitemap }) => {
      if (sitemap.status === 'error') return unknown('common.notEvaluated');
      if (sitemap.status !== 'ok') return { status: 'not-applicable', message: 'noSitemap' };
      if (pages.length === 0) return unknown(NO_PAGES);
      const conflicting = pages.filter((page) => page.inSitemap && page.noindex);
      return conflicting.length > 0
        ? { status: 'fail', message: 'conflict', values: { count: conflicting.length }, observed: listPaths(conflicting) }
        : { status: 'pass', message: 'ok' };
    },
  },
  {
    id: 'seo-social-tags',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const incomplete = pages.filter((page) => !page.og.title || !page.og.image);
      return incomplete.length > 0
        ? { status: 'warn', message: 'incomplete', values: { count: incomplete.length, total: pages.length }, observed: listPaths(incomplete) }
        : { status: 'pass', message: 'ok', values: { total: pages.length } };
    },
  },
  {
    id: 'seo-hreflang',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ pages }) => {
      if (pages.length === 0) return unknown(NO_PAGES);
      const withAlternates = pages.filter((page) => page.hreflang.length > 0);
      if (withAlternates.length === 0) return { status: 'not-applicable', message: 'singleLanguage' };
      const noDefault = withAlternates.filter((page) => !page.hreflang.includes('x-default'));
      return noDefault.length > 0
        ? { status: 'warn', message: 'noDefault', values: { count: noDefault.length }, observed: listPaths(noDefault) }
        : { status: 'pass', message: 'ok', values: { count: withAlternates.length } };
    },
  },
];

export const isGeoFinding = (id: string) => id.startsWith('geo-');
