// lib/engine/seo/page.ts
//
// What one HTML page tells search engines and AI answer engines: title and
// description, canonical and robots meta, headings, social tags, structured
// data, author and date signals, and its internal links (for discovery).
// Pure: takes the HTML, returns facts. Nothing here guesses.

import { parse, type HTMLElement } from 'node-html-parser';

export interface SeoArticleFacts {
  type: string;
  hasAuthor: boolean;
  hasDatePublished: boolean;
  hasDateModified: boolean;
}

export interface SeoPageFacts {
  url: string;
  title: string;
  description: string;
  canonical: string | null;
  robotsMeta: string;
  noindex: boolean;
  lang: string | null;
  hreflang: string[];
  h1: string[];
  h2Count: number;
  /** H2/H3 headings phrased as questions, the shape AI answers quote. */
  questionHeadings: number;
  og: { title: boolean; description: boolean; image: boolean };
  twitterCard: boolean;
  schema: {
    types: string[];
    /** JSON-LD blocks that are not valid JSON. */
    invalidBlocks: number;
    /** Types of nodes that carry business details (address, phone, opening hours). */
    businessTypes: string[];
    articles: SeoArticleFacts[];
  };
  /** Latest publish/update date the page states (schema, article meta tags, <time> in the content), ISO. */
  modifiedAt: string | null;
  /** Some author signal: meta author, rel=author, or a schema author. */
  hasAuthor: boolean;
  wordCount: number;
  internalLinks: string[];
  images: number;
  imagesWithoutAlt: number;
}

const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report', 'ScholarlyArticle']);
const MAX_LINKS = 300;

const text = (el: HTMLElement | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const metaContent = (root: HTMLElement, selector: string) => root.querySelector(selector)?.getAttribute('content')?.trim() ?? '';

/** Every @type in a JSON-LD value, through arrays and @graph, with article details. */
function collectSchema(value: unknown, types: Set<string>, articles: SeoArticleFacts[], business: Set<string>, depth = 0): void {
  if (depth > 8 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectSchema(item, types, articles, business, depth + 1);
    return;
  }
  const node = value as Record<string, unknown>;
  const rawType = node['@type'];
  const nodeTypes = (Array.isArray(rawType) ? rawType : [rawType]).filter((t): t is string => typeof t === 'string');
  for (const type of nodeTypes) types.add(type);
  if (['address', 'telephone', 'openingHours', 'openingHoursSpecification', 'geo'].some((key) => key in node)) {
    for (const type of nodeTypes) business.add(type);
  }
  const article = nodeTypes.find((type) => ARTICLE_TYPES.has(type));
  if (article) {
    articles.push({
      type: article,
      hasAuthor: Boolean(node.author),
      hasDatePublished: typeof node.datePublished === 'string',
      hasDateModified: typeof node.dateModified === 'string',
    });
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === '@context') continue;
    if (child && typeof child === 'object') collectSchema(child, types, articles, business, depth + 1);
  }
}

/** Dates published in the page, newest first. */
function datesIn(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) datesIn(item, out, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'dateModified' || key === 'datePublished') && typeof child === 'string') out.push(child);
    else if (child && typeof child === 'object') datesIn(child, out, depth + 1);
  }
}

function latestDate(candidates: string[]): string | null {
  let best: number | null = null;
  for (const candidate of candidates) {
    const time = Date.parse(candidate);
    if (Number.isFinite(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

function sameSite(a: URL, b: URL): boolean {
  const host = (url: URL) => url.hostname.replace(/^www\./, '');
  return host(a) === host(b);
}

export function parseSeoPage(html: string, pageUrl: string): SeoPageFacts {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const base = new URL(pageUrl);

  const robotsMeta = [metaContent(root, 'meta[name="robots"]'), metaContent(root, 'meta[name="googlebot"]')]
    .filter(Boolean)
    .join(', ')
    .toLowerCase();

  const types = new Set<string>();
  const articles: SeoArticleFacts[] = [];
  const business = new Set<string>();
  const dates: string[] = [];
  let invalidBlocks = 0;
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.rawText.trim());
      collectSchema(data, types, articles, business);
      datesIn(data, dates);
    } catch {
      invalidBlocks += 1;
    }
  }
  const metaModified = metaContent(root, 'meta[property="article:modified_time"]');
  const metaPublished = metaContent(root, 'meta[property="article:published_time"]');
  if (metaModified) dates.push(metaModified);
  if (metaPublished) dates.push(metaPublished);
  // Themes print post dates as <time datetime="…">; count those inside the content only.
  const content = root.querySelector('main') ?? root.querySelector('article');
  for (const time of content?.querySelectorAll('time[datetime]') ?? []) {
    const value = time.getAttribute('datetime');
    if (value) dates.push(value);
  }

  const headings = root.querySelectorAll('h2, h3').map((el) => text(el));

  const links = new Set<string>();
  for (const anchor of root.querySelectorAll('a[href]')) {
    if (links.size >= MAX_LINKS) break;
    const href = anchor.getAttribute('href') ?? '';
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const target = new URL(href, base);
      if (!/^https?:$/.test(target.protocol) || !sameSite(target, base)) continue;
      target.hash = '';
      links.add(target.toString());
    } catch {
      // Not a URL.
    }
  }

  const images = root.querySelectorAll('img');
  // Visible words: drop scripts, styles and navigation chrome before counting.
  const body = root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body') ?? root;
  const bodyClone = parse(body.toString());
  for (const el of bodyClone.querySelectorAll('script, style, noscript, nav, header, footer, svg')) el.remove();
  const words = text(bodyClone).split(' ').filter((word) => /\p{L}/u.test(word));

  const canonicalHref = root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
  let canonical: string | null = null;
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, base).toString();
    } catch {
      canonical = canonicalHref;
    }
  }

  return {
    url: pageUrl,
    title: text(root.querySelector('title')),
    description: metaContent(root, 'meta[name="description"]'),
    canonical,
    robotsMeta,
    noindex: /\bnoindex\b|\bnone\b/.test(robotsMeta),
    lang: root.querySelector('html')?.getAttribute('lang')?.trim() || null,
    hreflang: root
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .map((el) => (el.getAttribute('hreflang') ?? '').toLowerCase())
      .filter(Boolean),
    h1: root.querySelectorAll('h1').map((el) => text(el)),
    h2Count: root.querySelectorAll('h2').length,
    questionHeadings: headings.filter((heading) => /\?\s*$/.test(heading)).length,
    og: {
      title: Boolean(metaContent(root, 'meta[property="og:title"]')),
      description: Boolean(metaContent(root, 'meta[property="og:description"]')),
      image: Boolean(metaContent(root, 'meta[property="og:image"]')),
    },
    twitterCard: Boolean(metaContent(root, 'meta[name="twitter:card"]')),
    schema: { types: [...types].sort(), invalidBlocks, articles, businessTypes: [...business].sort() },
    modifiedAt: latestDate(dates),
    hasAuthor:
      Boolean(metaContent(root, 'meta[name="author"]')) ||
      Boolean(root.querySelector('a[rel~="author"], link[rel~="author"]')) ||
      articles.some((article) => article.hasAuthor),
    wordCount: words.length,
    internalLinks: [...links],
    images: images.length,
    imagesWithoutAlt: images.filter((img) => img.getAttribute('alt') === undefined).length,
  };
}
