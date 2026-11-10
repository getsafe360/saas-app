// lib/security/csp/links.ts
//
// Picks a few inner pages to scan besides the homepage: same host, real
// pages (no admin, feeds, files or query strings), one per first path segment
// so templates differ (blog post, shop, contact…).

const SKIP_PATH = /^\/(?:wp-admin|wp-login\.php|wp-json|xmlrpc\.php|feed|comments\/feed|wp-content|wp-includes|cart|checkout|my-account)(?:\/|$)/i;
const FILE = /\.(?:pdf|jpe?g|png|gif|webp|svg|zip|xml|txt|mp4|mp3|docx?|xlsx?)$/i;

export function pickInternalLinks(html: string, siteUrl: string, max = 4): string[] {
  const base = new URL(siteUrl);
  const picked = new Map<string, string>();
  for (const [, href] of html.matchAll(/<a\b[^>]*\shref\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.host !== base.host || (url.protocol !== 'http:' && url.protocol !== 'https:')) continue;
    if (url.search || SKIP_PATH.test(url.pathname) || FILE.test(url.pathname)) continue;
    if (url.pathname === '/' || url.pathname === base.pathname) continue;
    const segment = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (!picked.has(segment)) picked.set(segment, `${url.origin}${url.pathname}`);
    if (picked.size >= max) break;
  }
  return [...picked.values()];
}
