// lib/seo/crawl.ts
//
// Collects what the SEO/GEO checks need from a live site: robots.txt,
// llms.txt, the XML sitemap and up to MAX_PAGES pages (the homepage plus
// pages from the sitemap, or linked from the homepage). Every request goes
// through the same SSRF guard as the rest of the scanner, with size and time
// limits, and nothing failing here fails the crawl: a missing input becomes
// `unknown` in the rules.

import 'server-only';

import { fetchFollowingSafely, type UrlValidator } from '@/lib/net/safeFetch';
import { parseSeoPage } from '@/lib/engine/seo/page';
import { toCrawlPage, type SeoCrawl, type SeoCrawlPage, type SeoTextFile } from '@/lib/engine/seo/facts';
import { parseRobots } from '@/lib/engine/seo/robots';

export const MAX_PAGES = 10;
const PAGE_BYTES = 1_500_000;
const TEXT_BYTES = 300_000;
const SITEMAP_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 6000;
const BUDGET_MS = 25_000;
const CONCURRENCY = 3;
const MAX_CHILD_SITEMAPS = 3;
const NON_PAGE = /\.(xml|pdf|jpe?g|png|gif|webp|avif|svg|zip|mp4|mp3|docx?|xlsx?|pptx?|css|js|json|txt)(\?|$)/i;
const HEADERS = { 'User-Agent': 'GetSafe360Bot/1.0 (+https://www.getsafe360.ai)', Accept: 'text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5' };

/** Reads at most `max` bytes of a response body as text. */
async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.byteLength;
  }
  try {
    await reader.cancel();
  } catch {
    /* already closed */
  }
  const all = new Uint8Array(Math.min(size, max));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.byteLength, all.length - offset));
    all.set(part, offset);
    offset += part.byteLength;
    if (offset >= all.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

interface Fetched {
  status: number;
  url: string;
  contentType: string;
  body: string;
}

async function get(url: string, max: number, validate?: UrlValidator, deadline = Infinity): Promise<Fetched | null> {
  const remaining = deadline - Date.now();
  if (remaining < 500) return null;
  try {
    const res = await fetchFollowingSafely(url, { timeoutMs: Math.min(FETCH_TIMEOUT_MS, remaining), validate, headers: HEADERS });
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const body = res.status >= 200 && res.status < 300 ? await readCapped(res, max) : '';
    if (!body) {
      try {
        await res.body?.cancel();
      } catch {
        /* not needed */
      }
    }
    return { status: res.status, url: res.url || url, contentType, body };
  } catch {
    return null;
  }
}

function textFile(fetched: Fetched | null): SeoTextFile {
  if (!fetched) return { status: 'error', text: null, contentType: null };
  if (fetched.status === 404 || fetched.status === 410) return { status: 'missing', text: null, contentType: fetched.contentType };
  if (fetched.status < 200 || fetched.status >= 300) return { status: 'error', text: null, contentType: fetched.contentType };
  // A soft 404 (an HTML page served for any path) is not the file.
  if (fetched.contentType.includes('text/html') || /^\s*<(!doctype|html)/i.test(fetched.body)) {
    return { status: 'missing', text: null, contentType: fetched.contentType };
  }
  return { status: 'ok', text: fetched.body, contentType: fetched.contentType };
}

const locs = (xml: string) =>
  [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));

async function readSitemap(candidates: string[], listedInRobots: boolean, validate: UrlValidator | undefined, deadline: number) {
  for (const candidate of candidates) {
    const fetched = await get(candidate, SITEMAP_BYTES, validate, deadline);
    if (!fetched || fetched.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(fetched.body)) continue;

    let urls: string[] = [];
    let hasLastmod = /<lastmod>/i.test(fetched.body);
    if (/<sitemapindex\b/i.test(fetched.body)) {
      for (const child of locs(fetched.body).slice(0, MAX_CHILD_SITEMAPS)) {
        const sub = await get(child, SITEMAP_BYTES, validate, deadline);
        if (sub && sub.status === 200 && /<urlset\b/i.test(sub.body)) {
          urls = urls.concat(locs(sub.body));
          hasLastmod ||= /<lastmod>/i.test(sub.body);
        }
      }
    } else {
      urls = locs(fetched.body);
    }
    return { status: 'ok' as const, url: fetched.url, urls, listedInRobots, hasLastmod };
  }
  return { status: 'missing' as const, url: null, urls: [] as string[], listedInRobots, hasLastmod: false };
}

function pickPages(home: string, candidates: string[], limit: number): string[] {
  const homeUrl = new URL(home);
  const host = homeUrl.hostname.replace(/^www\./, '');
  const seen = new Set<string>([homeUrl.toString().replace(/\/$/, '')]);
  const picked: string[] = [];
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    let url: URL;
    try {
      url = new URL(candidate, homeUrl);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, '') !== host || NON_PAGE.test(url.pathname)) continue;
    url.hash = '';
    const key = url.toString().replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(url.toString());
  }
  return picked;
}

export async function crawlSite(siteUrl: string, opts: { validate?: UrlValidator; maxPages?: number } = {}): Promise<SeoCrawl> {
  const { validate } = opts;
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? MAX_PAGES, MAX_PAGES));
  const deadline = Date.now() + BUDGET_MS;
  const startedAt = new Date().toISOString();

  const home = await get(siteUrl, PAGE_BYTES, validate, deadline);
  const homeUrl = home?.url ?? siteUrl;
  const origin = new URL(homeUrl).origin;

  const [robotsFetched, llmsFetched] = await Promise.all([
    get(`${origin}/robots.txt`, TEXT_BYTES, validate, deadline),
    get(`${origin}/llms.txt`, TEXT_BYTES, validate, deadline),
  ]);
  const robots = textFile(robotsFetched);
  const llms = textFile(llmsFetched);

  const robotsSitemaps = robots.text ? parseRobots(robots.text).sitemaps : [];
  const sitemap = await readSitemap(
    [...robotsSitemaps, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`],
    robotsSitemaps.length > 0,
    validate,
    deadline,
  );

  const listed = new Set(sitemap.urls.map((url) => url.replace(/\/$/, '')));
  const inSitemap = (url: string) => listed.has(url.replace(/\/$/, ''));
  const pages: SeoCrawlPage[] = [];
  let pageErrors = 0;
  const homeOk = home && home.status === 200 && home.contentType.includes('html') && home.body;
  const homePage = homeOk ? parseSeoPage(home.body, homeUrl) : null;
  if (homePage) pages.push(toCrawlPage(homePage, inSitemap(homeUrl)));
  else pageErrors += 1;

  const fromLinks = homePage?.internalLinks ?? [];
  const others = pickPages(homeUrl, [...sitemap.urls, ...fromLinks], maxPages - 1);
  for (let i = 0; i < others.length; i += CONCURRENCY) {
    const batch = await Promise.all(others.slice(i, i + CONCURRENCY).map((url) => get(url, PAGE_BYTES, validate, deadline)));
    batch.forEach((fetched, j) => {
      if (fetched && fetched.status === 200 && fetched.contentType.includes('html') && fetched.body) {
        const url = fetched.url || others[i + j];
        pages.push(toCrawlPage(parseSeoPage(fetched.body, url), inSitemap(url)));
      } else {
        pageErrors += 1;
      }
    });
    if (Date.now() > deadline) break;
  }

  return {
    origin,
    checkedAt: startedAt,
    robots,
    llms,
    sitemap: { status: sitemap.status, url: sitemap.url, urlCount: sitemap.urls.length, listedInRobots: sitemap.listedInRobots, hasLastmod: sitemap.hasLastmod },
    pages,
    pageErrors,
  };
}
