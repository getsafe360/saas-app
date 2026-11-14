// lib/engine/seo/facts.ts
//
// What a crawl of a site observed for the SEO and GEO checks. Built by
// lib/seo/crawl.ts on the server; the rules only read it. A file or page that
// could not be fetched stays marked as such, so its checks report `unknown`.

import type { SeoPageFacts } from './page';

export interface SeoTextFile {
  /** `missing`: 404/410 or an HTML page served instead; `error`: not reachable. */
  status: 'ok' | 'missing' | 'error';
  text: string | null;
  contentType: string | null;
}

export type SeoCrawlPage = Omit<SeoPageFacts, 'internalLinks'> & {
  internalLinkCount: number;
  /** The page's URL is listed in the XML sitemap. */
  inSitemap: boolean;
  /** The site's homepage (the URL the crawl started from). */
  isHome: boolean;
};

export interface SeoCrawl {
  origin: string;
  checkedAt: string;
  robots: SeoTextFile;
  llms: SeoTextFile;
  sitemap: {
    /** `error`: not observed (timeout, server error, out of time). */
    status: 'ok' | 'missing' | 'error';
    url: string | null;
    urlCount: number;
    /** robots.txt names a sitemap. */
    listedInRobots: boolean;
    hasLastmod: boolean;
  };
  /** Crawled pages; the homepage, when it could be read, is marked isHome. */
  pages: SeoCrawlPage[];
  /** Pages that were picked but could not be read. */
  pageErrors: number;
}

export function toCrawlPage(page: SeoPageFacts, inSitemap: boolean, isHome: boolean): SeoCrawlPage {
  const { internalLinks, ...rest } = page;
  return { ...rest, internalLinkCount: internalLinks.length, inSitemap, isHome };
}
