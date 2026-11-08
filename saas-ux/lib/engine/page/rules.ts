// lib/engine/page/rules.ts
//
// Page-level checks shared by the quick analysis and the site scan, so the
// cockpit cards, the scan scores and the "Next step" box all come from the
// same rules. Ids match the scan issue ids the fix planner and stored scan
// reports use. Text lives in messages/Findings under each id.

import type { EngineCategory } from '../contracts';
import { type Rule, unknown } from '../rules';
import { SECURITY_HEADER_RULES } from '../security/headers';
import type { PageFacts } from './facts';

const NOT_WORDPRESS = 'common.notWordPress';
const NO_TITLE = 'common.noTitle';
const NO_DESCRIPTION = 'common.noDescription';

/** Header rules run on the page's own headers and HTTPS state. */
const PAGE_HEADER_RULES: ReadonlyArray<Rule<PageFacts>> = SECURITY_HEADER_RULES.map((rule) => ({
  ...rule,
  evaluate: (facts: PageFacts) => rule.evaluate({ https: facts.isHttps, headers: facts.headers }),
}));

export const PAGE_SEO_RULES: ReadonlyArray<Rule<PageFacts>> = [
  {
    id: 'seo-title-missing',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return meta.title ? { status: 'pass', message: 'present', observed: meta.title } : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'seo-title-short',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (!meta.title) return { status: 'not-applicable', message: NO_TITLE };
      return meta.titleLen < 20
        ? { status: 'fail', message: 'short', values: { length: meta.titleLen }, observed: meta.title }
        : { status: 'pass', message: 'ok', values: { length: meta.titleLen } };
    },
  },
  {
    id: 'seo-title-long',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (!meta.title) return { status: 'not-applicable', message: NO_TITLE };
      return meta.titleLen > 65
        ? { status: 'fail', message: 'long', values: { length: meta.titleLen }, observed: meta.title }
        : { status: 'pass', message: 'ok', values: { length: meta.titleLen } };
    },
  },
  {
    id: 'seo-meta-desc-missing',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return meta.description ? { status: 'pass', message: 'present' } : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'seo-meta-desc-short',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (!meta.description) return { status: 'not-applicable', message: NO_DESCRIPTION };
      return meta.descriptionLen < 80
        ? { status: 'fail', message: 'short', values: { length: meta.descriptionLen }, observed: meta.description }
        : { status: 'pass', message: 'ok', values: { length: meta.descriptionLen } };
    },
  },
  {
    id: 'seo-canonical-missing',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return meta.hasCanonical ? { status: 'pass', message: 'present' } : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'seo-noindex',
    category: 'seo',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return /noindex/i.test(meta.robotsMeta)
        ? { status: 'fail', message: 'noindex', observed: meta.robotsMeta }
        : { status: 'pass', message: 'indexable' };
    },
  },
  {
    id: 'seo-schema-missing',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return meta.hasJsonLd ? { status: 'pass', message: 'present' } : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'seo-og-missing',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (meta.hasOgTitle && meta.hasOgImage) return { status: 'pass', message: 'present' };
      return { status: 'fail', message: !meta.hasOgTitle && !meta.hasOgImage ? 'missing' : 'incomplete' };
    },
  },
  {
    id: 'seo-h1-missing',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ dom }) => {
      if (!dom) return unknown('common.pageNotRead');
      return dom.h1Count === 0 ? { status: 'fail', message: 'missing' } : { status: 'pass', message: 'present' };
    },
  },
  {
    id: 'seo-h1-multiple',
    category: 'seo',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ dom }) => {
      if (!dom) return unknown('common.pageNotRead');
      return dom.h1Count > 1
        ? { status: 'fail', message: 'multiple', values: { count: dom.h1Count }, observed: String(dom.h1Count) }
        : { status: 'pass', message: 'ok' };
    },
  },
];

export const PAGE_SECURITY_RULES: ReadonlyArray<Rule<PageFacts>> = [
  {
    id: 'sec-no-https',
    category: 'security',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ isHttps, finalUrl }) => {
      if (isHttps === null) return unknown('httpsUnknown');
      return isHttps
        ? { status: 'pass', message: 'https' }
        : { status: 'fail', message: 'http', observed: finalUrl ?? undefined };
    },
  },
  ...PAGE_HEADER_RULES,
  {
    id: 'sec-version-disclosure',
    category: 'security',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ headers }) => {
      if (!headers) return unknown('common.headersNotCaptured');
      const server = headers['server'] ?? '';
      const poweredBy = headers['x-powered-by'] ?? '';
      return /\d+\.\d+/.test(server) || /\d+\.\d+/.test(poweredBy)
        ? { status: 'fail', message: 'disclosed', observed: [server, poweredBy].filter(Boolean).join(' / ') }
        : { status: 'pass', message: 'hidden' };
    },
  },
  {
    id: 'sec-wp-xmlrpc',
    category: 'security',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ wordpress }) => {
      if (!wordpress) return { status: 'not-applicable', message: NOT_WORDPRESS };
      if (wordpress.xmlrpc === null) return unknown('unknown');
      return wordpress.xmlrpc ? { status: 'fail', message: 'reachable' } : { status: 'pass', message: 'blocked' };
    },
  },
  {
    id: 'sec-wp-user-enum',
    category: 'security',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ wordpress }) => {
      if (!wordpress) return { status: 'not-applicable', message: NOT_WORDPRESS };
      if (wordpress.usersExposed === null) return unknown('unknown');
      return wordpress.usersExposed ? { status: 'fail', message: 'exposed' } : { status: 'pass', message: 'blocked' };
    },
  },
  {
    id: 'sec-wp-version-exposed',
    category: 'security',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ wordpress }) => {
      if (!wordpress) return { status: 'not-applicable', message: NOT_WORDPRESS };
      return wordpress.version
        ? { status: 'fail', message: 'exposed', values: { version: wordpress.version }, observed: `WordPress ${wordpress.version}` }
        : { status: 'pass', message: 'hidden' };
    },
  },
];

export const PAGE_ACCESSIBILITY_RULES: ReadonlyArray<Rule<PageFacts>> = [
  {
    id: 'a11y-img-alt',
    category: 'accessibility',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ accessibility, dom }) => {
      if (!accessibility || !dom) return unknown('common.pageNotRead');
      if (accessibility.imgMissingAlt === 0) return { status: 'pass', message: 'ok' };
      const ratio = Math.round(accessibility.imgWithoutAltRatio * 100);
      return {
        status: 'fail',
        severity: ratio > 50 ? 'high' : 'medium',
        message: 'missing',
        values: { missing: accessibility.imgMissingAlt, total: dom.imgCount, ratio },
        observed: String(accessibility.imgMissingAlt),
      };
    },
  },
  {
    id: 'a11y-lang-missing',
    category: 'accessibility',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ siteLang, meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      return siteLang
        ? { status: 'pass', message: 'present', values: { lang: siteLang } }
        : { status: 'fail', message: 'missing' };
    },
  },
  {
    id: 'a11y-heading-structure',
    category: 'accessibility',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ dom }) => {
      if (!dom) return unknown('common.pageNotRead');
      return dom.h1Count === 0 ? { status: 'fail', message: 'missing' } : { status: 'pass', message: 'present' };
    },
  },
];

export const PAGE_PERFORMANCE_RULES: ReadonlyArray<Rule<PageFacts>> = [
  {
    id: 'perf-script-count',
    category: 'performance',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ perf, dom }) => {
      if (!perf || !dom) return unknown('common.pageNotRead');
      return perf.heavyScriptHint
        ? { status: 'fail', message: 'many', values: { count: dom.scriptCount }, observed: String(dom.scriptCount) }
        : { status: 'pass', message: 'ok', values: { count: dom.scriptCount } };
    },
  },
  {
    id: 'perf-image-count',
    category: 'performance',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ perf, dom }) => {
      if (!perf || !dom) return unknown('common.pageNotRead');
      return perf.heavyImageHint
        ? { status: 'fail', message: 'many', values: { count: dom.imgCount }, observed: String(dom.imgCount) }
        : { status: 'pass', message: 'ok', values: { count: dom.imgCount } };
    },
  },
  {
    id: 'perf-html-size',
    category: 'performance',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ perf }) => {
      if (!perf) return unknown('common.pageNotRead');
      const kb = Math.round(perf.approxHtmlBytes / 1024);
      return perf.approxHtmlBytes > 150_000
        ? { status: 'fail', message: 'large', values: { kb }, observed: `${kb} KB` }
        : { status: 'pass', message: 'ok', values: { kb } };
    },
  },
  {
    id: 'perf-no-compression',
    category: 'performance',
    severity: 'high',
    source: 'external-probe',
    evaluate: ({ headers }) => {
      if (!headers) return unknown('common.headersNotCaptured');
      const encoding = headers['content-encoding'] ?? '';
      return encoding
        ? { status: 'pass', message: 'compressed', values: { encoding }, observed: encoding }
        : { status: 'fail', message: 'uncompressed' };
    },
  },
  {
    id: 'perf-no-cache-header',
    category: 'performance',
    severity: 'low',
    source: 'external-probe',
    evaluate: ({ headers }) => {
      if (!headers) return unknown('common.headersNotCaptured');
      const cacheControl = headers['cache-control'] ?? '';
      return cacheControl
        ? { status: 'pass', message: 'present', observed: cacheControl }
        : { status: 'fail', message: 'missing' };
    },
  },
];

/** Content checks for the Content card (not part of the site scan). */
export const PAGE_CONTENT_RULES: ReadonlyArray<Rule<PageFacts>> = [
  {
    id: 'content-title-length',
    category: 'content',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (!meta.title) return { status: 'not-applicable', message: NO_TITLE };
      return meta.titleLen >= 30 && meta.titleLen <= 60
        ? { status: 'pass', message: 'ok', values: { length: meta.titleLen } }
        : { status: 'warn', message: 'outside', values: { length: meta.titleLen } };
    },
  },
  {
    id: 'content-desc-length',
    category: 'content',
    severity: 'medium',
    source: 'external-probe',
    evaluate: ({ meta }) => {
      if (!meta) return unknown('common.pageNotRead');
      if (!meta.description) return { status: 'not-applicable', message: NO_DESCRIPTION };
      return meta.descriptionLen >= 120 && meta.descriptionLen <= 160
        ? { status: 'pass', message: 'ok', values: { length: meta.descriptionLen } }
        : { status: 'warn', message: 'outside', values: { length: meta.descriptionLen } };
    },
  },
];

/** The checks the site scan runs, in scan order. */
export const PAGE_SCAN_RULES: ReadonlyArray<Rule<PageFacts>> = [
  ...PAGE_SEO_RULES,
  ...PAGE_SECURITY_RULES,
  ...PAGE_ACCESSIBILITY_RULES,
  ...PAGE_PERFORMANCE_RULES,
];

/** Everything the cockpit cards show for a page. */
export const PAGE_RULES: ReadonlyArray<Rule<PageFacts>> = [...PAGE_SCAN_RULES, ...PAGE_CONTENT_RULES];

export const PAGE_CARD_CATEGORIES: ReadonlyArray<EngineCategory> = [
  'performance',
  'security',
  'seo',
  'accessibility',
  'content',
];
