// lib/security/csp/scan.ts
//
// Loads the homepage and a few inner pages (public addresses only, every
// redirect hop checked) and extracts what they load.

import 'server-only';

import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { fetchFollowingSafely } from '@/lib/net/safeFetch';
import { pickInternalLinks } from './links';
import { extractResources, type PageResources } from './policy';

const MAX_BYTES = 1_500_000;
const USER_AGENT = 'GetSafe360-CSPBuilder/1.0';

export interface ScannedPage {
  url: string;
  resources: PageResources;
}

async function fetchHtml(url: string): Promise<{ html: string; headers: Headers } | null> {
  try {
    const response = await fetchFollowingSafely(url, {
      timeoutMs: 12_000,
      validate: isPublicUrlResolved,
      headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
    });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('html')) return null;
    const html = (await response.text()).slice(0, MAX_BYTES);
    return { html, headers: response.headers };
  } catch {
    return null;
  }
}

export async function scanSitePages(siteUrl: string): Promise<{
  pages: ScannedPage[];
  current: { enforced: string | null; reportOnly: string | null };
}> {
  const home = await fetchHtml(siteUrl);
  if (!home) return { pages: [], current: { enforced: null, reportOnly: null } };
  const links = pickInternalLinks(home.html, siteUrl, 4);
  const inner = await Promise.all(links.map(async (url) => ({ url, page: await fetchHtml(url) })));
  return {
    pages: [
      { url: siteUrl, resources: extractResources(home.html) },
      ...inner.filter((entry) => entry.page).map((entry) => ({ url: entry.url, resources: extractResources(entry.page!.html) })),
    ],
    current: {
      enforced: home.headers.get('content-security-policy'),
      reportOnly: home.headers.get('content-security-policy-report-only'),
    },
  };
}
