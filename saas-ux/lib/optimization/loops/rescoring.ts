// lib/optimization/loops/rescoring.ts
// Tier 2: Lightweight category-only rescorer.
// Re-scores from live page HTML without running a full GetSafe scan.
// Fast (~1s), covers only the category being optimized.

// ── SEO scorer ────────────────────────────────────────────────────────────────

interface SeoSignal {
  key: string;
  points: number;
  test: (html: string) => boolean;
}

const SEO_SIGNALS: SeoSignal[] = [
  { key: 'title',         points: 10, test: (h) => /<title[^>]*>[^<]+<\/title>/i.test(h) },
  { key: 'metaDesc',      points: 12, test: (h) => /name=["']description["'][^>]+content=["'][^"']{20,}/i.test(h) || /content=["'][^"']{20,}["'][^>]+name=["']description["']/i.test(h) },
  { key: 'canonical',     points: 10, test: (h) => /rel=["']canonical["']/i.test(h) },
  { key: 'ogTitle',       points: 5,  test: (h) => /property=["']og:title["']/i.test(h) },
  { key: 'ogDesc',        points: 5,  test: (h) => /property=["']og:description["']/i.test(h) },
  { key: 'ogType',        points: 3,  test: (h) => /property=["']og:type["']/i.test(h) },
  { key: 'ogUrl',         points: 3,  test: (h) => /property=["']og:url["']/i.test(h) },
  { key: 'twitterCard',   points: 6,  test: (h) => /name=["']twitter:card["']/i.test(h) },
  { key: 'jsonLd',        points: 10, test: (h) => /application\/ld\+json/i.test(h) },
  { key: 'orgSchema',     points: 8,  test: (h) => /"@type"\s*:\s*"Organization"/i.test(h) },
  { key: 'websiteSchema', points: 8,  test: (h) => /"@type"\s*:\s*"WebSite"/i.test(h) },
  { key: 'h1',            points: 7,  test: (h) => /<h1[\s>]/i.test(h) },
  { key: 'noIndex',       points: -20, test: (h) => /name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(h) || /content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(h) },
];

// Sum of all positive points
const SEO_MAX = SEO_SIGNALS.reduce((sum, s) => s.points > 0 ? sum + s.points : sum, 0);

export function rescoreSeoFromHtml(html: string): number {
  let raw = 0;
  for (const signal of SEO_SIGNALS) {
    if (signal.test(html)) raw += signal.points;
  }
  // Clamp [0, SEO_MAX] then normalize to 0-100
  const clamped = Math.max(0, Math.min(SEO_MAX, raw));
  return Math.round((clamped / SEO_MAX) * 100);
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Tier 2: Re-score a single category from live HTML.
 * Returns null if no lightweight scorer exists for that category
 * (caller keeps the previous estimated score).
 */
export function rescoreCategoryFromHtml(html: string, category: string): number | null {
  switch (category) {
    case 'seo':
      return rescoreSeoFromHtml(html);
    default:
      return null;
  }
}

/**
 * Tier 2: Fetch the page and rescore.
 * Reuses the HTML from verifyFix when possible (pass it via `cachedHtml`).
 */
export async function rescoreCategory(
  siteUrl: string,
  category: string,
  cachedHtml?: string,
): Promise<number | null> {
  const html = cachedHtml ?? await fetchPageHtml(siteUrl);
  if (!html) return null;
  return rescoreCategoryFromHtml(html, category);
}

async function fetchPageHtml(siteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': 'GetSafe360-Rescorer/1.0' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
