// lib/seo/llms.ts
//
// A first llms.txt (https://llmstxt.org) built from what the crawl saw: the
// site's name and summary from the home page, then its pages with their own
// titles and descriptions. Rule-based, no AI, nothing the site doesn't publish.

import type { SeoCrawl, SeoCrawlPage } from '@/lib/engine/seo/facts';

const MAX_PAGES = 25;
const MAX_DESCRIPTION = 200;

/** One line of plain text: no line breaks, collapsed spaces, trimmed to `max`. */
function oneLine(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Text inside a markdown link label: brackets would end it early. */
function linkLabel(text: string): string {
  return text.replace(/[[\]]/g, '');
}

const TITLE_SEPARATORS = /\s+[|–—\-·:]\s+/;

/** The site's name from the home title: "Home | Bakery Müller" → "Bakery Müller". */
export function siteNameFrom(home: SeoCrawlPage | undefined, origin: string): string {
  const title = oneLine(home?.title ?? '', 120);
  if (!title) return new URL(origin).hostname.replace(/^www\./, '');
  const parts = title.split(TITLE_SEPARATORS).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return title;
  // "Home", "Startseite", "Welcome" are not names; otherwise WordPress puts the site name last.
  const generic = /^(home|homepage|start|startseite|welcome|willkommen|inicio|accueil|home page)$/i;
  const named = parts.filter((part) => !generic.test(part));
  return named.length > 0 ? named[named.length - 1] : parts[parts.length - 1];
}

function pageTitle(page: SeoCrawlPage, siteName: string): string {
  const raw = oneLine(page.title || page.h1[0] || '', 120);
  if (!raw) return new URL(page.url).pathname;
  // Drop the "| Site name" suffix every page repeats.
  const parts = raw.split(TITLE_SEPARATORS).filter((part) => part.trim() !== siteName);
  return parts.join(' – ') || raw;
}

export function buildLlmsTxt(crawl: SeoCrawl): string | null {
  const indexable = crawl.pages.filter((page) => !page.noindex);
  const home = indexable.find((page) => page.isHome);
  if (!home) return null;

  const siteName = siteNameFrom(home, crawl.origin);
  const lines = [`# ${oneLine(siteName, 120)}`, ''];
  const summary = oneLine(home.description || home.excerpt || '', MAX_DESCRIPTION);
  if (summary) lines.push(`> ${summary}`, '');

  const others = indexable
    .filter((page) => !page.isHome)
    // Pages the sitemap lists first: the site itself says they matter.
    .sort((a, b) => Number(b.inSitemap) - Number(a.inSitemap))
    .slice(0, MAX_PAGES);

  lines.push('## Pages', '');
  for (const page of [home, ...others]) {
    const label = linkLabel(page.isHome ? `${siteName}: home` : pageTitle(page, siteName));
    const description = oneLine(page.description, MAX_DESCRIPTION);
    lines.push(`- [${label}](${page.url})${description ? `: ${description}` : ''}`);
  }
  return `${lines.join('\n').trim()}\n`;
}
