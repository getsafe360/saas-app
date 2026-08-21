// lib/scan/rules.ts
//
// Deterministic issue detection from a preScan() result plus the response
// headers. Every rule here is checkable without an LLM, which is what makes
// the scan reproducible: the same site scanned twice produces the same
// findings, and each finding points at something we can actually verify.
//
// Rules that map onto a fix the WordPress connector can genuinely perform
// carry `fixAvailable: true`. Everything else is reported as advice only —
// we must never offer a "Fix" button for something we cannot do, because the
// fix flow charges tokens.

import type { ScanIssue, ScanCategory, Severity } from '@/lib/scan/types';

export type PreScanResult = Awaited<ReturnType<typeof import('@/lib/analyzer/preScan').preScan>>;

type RuleContext = {
  pre: PreScanResult;
  headers: Record<string, string>;
};

function issue(
  id: string,
  category: ScanCategory,
  severity: Severity,
  title: string,
  description: string,
  suggestion: string,
  opts: { fixAvailable?: boolean; estTokens?: number; evidence?: string } = {}
): ScanIssue {
  return {
    id,
    category,
    severity,
    title,
    description,
    suggestion,
    fixAvailable: opts.fixAvailable ?? false,
    estTokens: opts.estTokens ?? 0,
    evidence: opts.evidence,
  };
}

// ─── SEO ────────────────────────────────────────────────────────────────────

function seoRules({ pre }: RuleContext): ScanIssue[] {
  const found: ScanIssue[] = [];
  const {
    title,
    description,
    titleLen,
    descriptionLen,
    hasCanonical,
    robotsMeta,
    hasJsonLd,
    hasOgTitle,
    hasOgImage,
  } = pre.meta;

  // Note on fixAvailable for title rules: the connector injects into <head>
  // through wp_kses with a meta/link allowlist, so it cannot emit or replace a
  // <title> element — the theme owns that. These stay advice-only. Offering a
  // paid "Fix" button for something we cannot perform would be worse than
  // offering nothing.
  if (!title) {
    found.push(
      issue(
        'seo-title-missing',
        'seo',
        'high',
        'Page has no title tag',
        'The homepage does not expose a <title>. Search engines and AI answer engines fall back to the domain name or arbitrary page text.',
        'Add a unique 40–60 character title in your theme or SEO plugin settings.'
      )
    );
  } else if (titleLen < 20) {
    found.push(
      issue(
        'seo-title-short',
        'seo',
        'medium',
        'Title tag is very short',
        `The title is ${titleLen} characters, which usually means it carries no descriptive keywords.`,
        'Expand the title to 40–60 characters including the primary topic and brand.',
        { evidence: title }
      )
    );
  } else if (titleLen > 65) {
    found.push(
      issue(
        'seo-title-long',
        'seo',
        'low',
        'Title tag is likely truncated',
        `The title is ${titleLen} characters and will be cut off in most search results.`,
        'Trim the title to about 60 characters, keeping the most important words first.',
        { evidence: title }
      )
    );
  }

  if (!description) {
    found.push(
      issue(
        'seo-meta-desc-missing',
        'seo',
        'high',
        'Missing meta description',
        'No meta description was found, so search engines generate their own snippet from page text.',
        'Add a 120–160 character meta description summarising the page.',
        { fixAvailable: true, estTokens: 700 }
      )
    );
  } else if (descriptionLen < 80) {
    found.push(
      issue(
        'seo-meta-desc-short',
        'seo',
        'medium',
        'Meta description is too short',
        `The meta description is ${descriptionLen} characters — too short to use the available snippet space.`,
        'Expand it to 120–160 characters.',
        { fixAvailable: true, estTokens: 700, evidence: description }
      )
    );
  }

  if (!hasCanonical) {
    found.push(
      issue(
        'seo-canonical-missing',
        'seo',
        'medium',
        'No canonical URL declared',
        'Without a canonical link, duplicate URLs (with and without trailing slash, query parameters, or www) can compete with each other.',
        'Add <link rel="canonical"> pointing at the preferred URL.',
        { fixAvailable: true, estTokens: 500 }
      )
    );
  }

  if (/noindex/i.test(robotsMeta)) {
    found.push(
      issue(
        'seo-noindex',
        'seo',
        'high',
        'Page is marked noindex',
        'A robots meta tag tells search engines not to index this page. If this is the live homepage, the site is invisible in search.',
        'Remove the noindex directive unless this page is intentionally hidden.',
        { evidence: robotsMeta }
      )
    );
  }

  if (!hasJsonLd) {
    found.push(
      issue(
        'seo-schema-missing',
        'seo',
        'medium',
        'No structured data (schema.org)',
        'The page publishes no JSON-LD structured data, so search engines and AI answer engines have to infer what the business is, where it operates and how to contact it.',
        'Publish Organization (or LocalBusiness) structured data in the page head.',
        { fixAvailable: true, estTokens: 900 }
      )
    );
  }

  if (!hasOgTitle || !hasOgImage) {
    found.push(
      issue(
        'seo-og-missing',
        'seo',
        'low',
        'Incomplete social sharing tags',
        `Open Graph tags are ${!hasOgTitle && !hasOgImage ? 'missing' : 'incomplete'}, so links shared on social platforms and messaging apps render without a proper title or preview image.`,
        'Add og:title, og:description, og:image and twitter:card tags.',
        { fixAvailable: true, estTokens: 700 }
      )
    );
  }

  if (pre.dom.h1Count === 0) {
    found.push(
      issue(
        'seo-h1-missing',
        'seo',
        'medium',
        'No H1 heading',
        'The page has no H1, so the main topic is not stated in the document outline.',
        'Add exactly one H1 that states what the page is about.'
      )
    );
  } else if (pre.dom.h1Count > 1) {
    found.push(
      issue(
        'seo-h1-multiple',
        'seo',
        'low',
        'Multiple H1 headings',
        `The page has ${pre.dom.h1Count} H1 elements, which dilutes the topical signal.`,
        'Keep one H1 and demote the rest to H2.'
      )
    );
  }

  return found;
}

// ─── Security ───────────────────────────────────────────────────────────────

const SECURITY_HEADERS: Array<{
  header: string;
  id: string;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
}> = [
  {
    header: 'strict-transport-security',
    id: 'sec-hsts',
    severity: 'high',
    title: 'Missing HSTS header',
    description:
      'Strict-Transport-Security is not set, so a visitor\'s first request can be downgraded to plain HTTP and intercepted.',
    suggestion: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains.',
  },
  {
    header: 'content-security-policy',
    id: 'sec-csp',
    severity: 'medium',
    title: 'No Content-Security-Policy',
    description:
      'Without a CSP, any injected script on the page executes with full privileges.',
    suggestion: 'Start with a report-only policy, then tighten it once violations are understood.',
  },
  {
    header: 'x-content-type-options',
    id: 'sec-nosniff',
    severity: 'medium',
    title: 'Missing X-Content-Type-Options',
    description: 'Browsers may MIME-sniff responses, which can turn an uploaded file into executable script.',
    suggestion: 'Send X-Content-Type-Options: nosniff.',
  },
  {
    header: 'referrer-policy',
    id: 'sec-referrer-policy',
    severity: 'low',
    title: 'No Referrer-Policy',
    description: 'Full URLs are leaked to third-party sites in the Referer header.',
    suggestion: 'Send Referrer-Policy: strict-origin-when-cross-origin.',
  },
  {
    header: 'x-frame-options',
    id: 'sec-frame-options',
    severity: 'medium',
    title: 'No clickjacking protection',
    description:
      'Neither X-Frame-Options nor a CSP frame-ancestors directive was found, so the page can be framed by an attacker.',
    suggestion: 'Send X-Frame-Options: SAMEORIGIN or a CSP frame-ancestors directive.',
  },
];

function securityRules({ pre, headers }: RuleContext): ScanIssue[] {
  const found: ScanIssue[] = [];

  if (!pre.isHttps) {
    found.push(
      issue(
        'sec-no-https',
        'security',
        'high',
        'Site is not served over HTTPS',
        'The final URL after redirects is plain HTTP. All traffic, including form submissions, travels unencrypted.',
        'Install a TLS certificate and redirect all HTTP traffic to HTTPS.',
        { evidence: pre.finalUrl }
      )
    );
  }

  const csp = headers['content-security-policy'] ?? '';
  for (const rule of SECURITY_HEADERS) {
    if (headers[rule.header]) continue;
    // frame-ancestors in a CSP supersedes X-Frame-Options.
    if (rule.header === 'x-frame-options' && /frame-ancestors/i.test(csp)) continue;
    // HSTS is meaningless over plain HTTP; we already reported the bigger problem.
    if (rule.header === 'strict-transport-security' && !pre.isHttps) continue;
    found.push(
      issue(rule.id, 'security', rule.severity, rule.title, rule.description, rule.suggestion)
    );
  }

  const server = headers['server'] ?? '';
  const poweredBy = headers['x-powered-by'] ?? '';
  if (/\d+\.\d+/.test(server) || /\d+\.\d+/.test(poweredBy)) {
    found.push(
      issue(
        'sec-version-disclosure',
        'security',
        'low',
        'Server software version disclosed',
        'Response headers reveal exact software versions, which helps an attacker match known exploits.',
        'Suppress version numbers in the Server and X-Powered-By headers.',
        { evidence: [server, poweredBy].filter(Boolean).join(' / ') }
      )
    );
  }

  if (pre.cms.type === 'wordpress') {
    if (pre.cms.wp.xmlrpc) {
      found.push(
        issue(
          'sec-wp-xmlrpc',
          'security',
          'medium',
          'XML-RPC is reachable',
          'xmlrpc.php is enabled. It is a common target for brute-force amplification and pingback abuse, and almost no modern site needs it.',
          'Disable XML-RPC unless a connected app depends on it.',
          // The connector's action gateway implements exactly this toggle.
          { fixAvailable: true, estTokens: 400 }
        )
      );
    }
    if (pre.cms.wp.jsonApi) {
      found.push(
        issue(
          'sec-wp-user-enum',
          'security',
          'medium',
          'User enumeration is possible',
          'The WordPress REST API exposes /wp-json/wp/v2/users, letting anyone list valid usernames for a brute-force attempt.',
          'Block unauthenticated user enumeration.',
          // Connector setting: blockUserEnumeration.
          { fixAvailable: true, estTokens: 400 }
        )
      );
    }
    if (pre.cms.wp.version) {
      found.push(
        issue(
          'sec-wp-version-exposed',
          'security',
          'low',
          'WordPress version is public',
          `The generator meta tag advertises WordPress ${pre.cms.wp.version}, making it trivial to look up matching vulnerabilities.`,
          'Remove the generator meta tag.',
          { evidence: `WordPress ${pre.cms.wp.version}` }
        )
      );
    }
  }

  return found;
}

// ─── Accessibility ──────────────────────────────────────────────────────────

function accessibilityRules({ pre }: RuleContext): ScanIssue[] {
  const found: ScanIssue[] = [];
  const { imgMissingAlt, imgWithoutAltRatio } = pre.accessibility;

  if (imgMissingAlt > 0) {
    const ratio = Math.round(imgWithoutAltRatio * 100);
    found.push(
      issue(
        'a11y-img-alt',
        'accessibility',
        ratio > 50 ? 'high' : 'medium',
        'Images without alt text',
        `${imgMissingAlt} of ${pre.dom.imgCount} images (${ratio}%) have no alt attribute, so screen readers announce nothing for them.`,
        'Add descriptive alt text, or alt="" for images that are purely decorative.'
      )
    );
  }

  if (!pre.siteLang) {
    found.push(
      issue(
        'a11y-lang-missing',
        'accessibility',
        'medium',
        'No document language declared',
        'The <html> element has no lang attribute, so screen readers cannot choose the right pronunciation rules.',
        'Add lang="en" (or the correct language code) to the <html> element.'
      )
    );
  }

  if (pre.dom.h1Count === 0) {
    found.push(
      issue(
        'a11y-heading-structure',
        'accessibility',
        'low',
        'No top-level heading for navigation',
        'Screen reader users navigate by headings. With no H1 there is no entry point to the page structure.',
        'Add a single H1 as the first heading on the page.'
      )
    );
  }

  return found;
}

// ─── Performance ────────────────────────────────────────────────────────────

function performanceRules({ pre, headers }: RuleContext): ScanIssue[] {
  const found: ScanIssue[] = [];

  if (pre.perfHints.heavyScriptHint) {
    found.push(
      issue(
        'perf-script-count',
        'performance',
        'medium',
        'Large number of script tags',
        `${pre.dom.scriptCount} script elements were found in the HTML. Each one is a parse and, usually, a network round trip.`,
        'Bundle or defer non-critical scripts and remove unused plugins.'
      )
    );
  }

  if (pre.perfHints.heavyImageHint) {
    found.push(
      issue(
        'perf-image-count',
        'performance',
        'medium',
        'Very image-heavy page',
        `${pre.dom.imgCount} images are referenced on a single page.`,
        'Lazy-load below-the-fold images and serve modern formats (WebP/AVIF).'
      )
    );
  }

  if (pre.perfHints.approxHtmlBytes > 150_000) {
    found.push(
      issue(
        'perf-html-size',
        'performance',
        'medium',
        'HTML document is very large',
        `The HTML response is roughly ${Math.round(pre.perfHints.approxHtmlBytes / 1024)} KB before any assets load.`,
        'Move inline styles and data blobs out of the document and paginate long pages.'
      )
    );
  }

  const encoding = headers['content-encoding'] ?? '';
  if (!encoding) {
    found.push(
      issue(
        'perf-no-compression',
        'performance',
        'high',
        'HTML is served uncompressed',
        'No Content-Encoding header was returned, so the document transfers at full size.',
        'Enable Brotli or gzip compression at the server or CDN.'
      )
    );
  }

  const cacheControl = headers['cache-control'] ?? '';
  if (!cacheControl) {
    found.push(
      issue(
        'perf-no-cache-header',
        'performance',
        'low',
        'No Cache-Control header',
        'Without explicit caching rules, browsers and CDNs have to guess how long the response stays fresh.',
        'Set an explicit Cache-Control policy for HTML and static assets.'
      )
    );
  }

  return found;
}

export function runRules(ctx: RuleContext): ScanIssue[] {
  return [
    ...seoRules(ctx),
    ...securityRules(ctx),
    ...accessibilityRules(ctx),
    ...performanceRules(ctx),
  ];
}
