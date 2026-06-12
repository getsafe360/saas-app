// lib/optimization/loops/categories/seoLoop.ts
// SEO issue selector and fix plan generator
// Only generates fixes for facts that can be verified from the scan snapshot.
// Never invents business facts (names, addresses, phone numbers, legal claims).

import { randomUUID } from 'crypto';
import type { FixPlan, SiteSnapshot } from '../types';
import { validateSnippet } from '../../fixes/fixPolicies';

// ── Issue definitions ─────────────────────────────────────────────────────────

interface SeoIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  // Returns true if the issue exists on the snapshot
  detect: (s: SiteSnapshot) => boolean;
  // Returns a fix plan, or null if facts aren't available
  buildFix: (s: SiteSnapshot) => FixPlan | null;
}

// Ordered by priority (highest-impact first)
const SEO_ISSUES: SeoIssue[] = [
  {
    id: 'seo-meta-description',
    title: 'Missing meta description',
    severity: 'high',
    detect: (s) => !s.seoFacts.metaDescription,
    buildFix: (s) => {
      // Derive a description from the page title and URL only — no invented facts
      const title = s.seoFacts.pageTitle || s.seoFacts.h1Text;
      if (!title) return null;

      // Keep it generic and safe
      const orgName = s.seoFacts.orgName;
      const description = orgName
        ? `${orgName} — ${title}. Explore our services and get in touch with us today.`
        : `${title} — Discover more on our website.`;

      const snippet = `<meta name="description" content="${escapeAttr(description.slice(0, 160))}">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-meta-description-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-meta-description',
        fixType: 'meta_tag',
        title: 'Add meta description',
        summary: 'Adds a concise description for search engine result pages.',
        issueId: 'seo-meta-description',
        issueTitle: 'Missing meta description',
        issueSeverity: 'high',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add meta description',
          section: 'seo',
          summary: 'Adds a meta description to improve search result appearance.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-canonical',
    title: 'Missing canonical URL',
    severity: 'high',
    detect: (s) => !s.seoFacts.hasCanonical,
    buildFix: (s) => {
      const url = s.seoFacts.canonicalUrl || s.siteUrl;
      const snippet = `<link rel="canonical" href="${escapeAttr(url)}">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-canonical-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-canonical',
        fixType: 'link_tag',
        title: 'Add canonical URL',
        summary: 'Sets the preferred URL for this page to prevent duplicate content issues.',
        issueId: 'seo-canonical',
        issueTitle: 'Missing canonical URL',
        issueSeverity: 'high',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add canonical URL',
          section: 'seo',
          summary: 'Adds a canonical link tag to clarify the preferred page URL.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-og-title',
    title: 'Missing Open Graph title',
    severity: 'medium',
    detect: (s) => !s.seoFacts.hasOgTitle,
    buildFix: (s) => {
      const title = s.seoFacts.pageTitle || s.seoFacts.h1Text;
      if (!title) return null;

      const snippet = `<meta property="og:title" content="${escapeAttr(title)}">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-og-title-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-og-title',
        fixType: 'meta_tag',
        title: 'Add Open Graph title',
        summary: 'Sets the title shown when this page is shared on social media.',
        issueId: 'seo-og-title',
        issueTitle: 'Missing Open Graph title',
        issueSeverity: 'medium',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Open Graph title',
          section: 'seo',
          summary: 'Adds og:title for social sharing.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-og-description',
    title: 'Missing Open Graph description',
    severity: 'medium',
    detect: (s) => !s.seoFacts.hasOgDescription && !!s.seoFacts.metaDescription,
    buildFix: (s) => {
      const desc = s.seoFacts.metaDescription;
      if (!desc) return null;

      const snippet = `<meta property="og:description" content="${escapeAttr(desc)}">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-og-description-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-og-description',
        fixType: 'meta_tag',
        title: 'Add Open Graph description',
        summary: 'Uses the existing meta description for social media sharing.',
        issueId: 'seo-og-description',
        issueTitle: 'Missing Open Graph description',
        issueSeverity: 'medium',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Open Graph description',
          section: 'seo',
          summary: 'Adds og:description for social sharing.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-og-url',
    title: 'Missing Open Graph URL',
    severity: 'low',
    detect: (s) => !s.seoFacts.hasOgTitle, // proxy: if missing OG tags at all
    buildFix: (s) => {
      const url = s.siteUrl;
      const snippet = `<meta property="og:url" content="${escapeAttr(url)}">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-og-url-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-og-url',
        fixType: 'meta_tag',
        title: 'Add Open Graph URL',
        summary: 'Sets the canonical URL for social media sharing.',
        issueId: 'seo-og-url',
        issueTitle: 'Missing Open Graph URL',
        issueSeverity: 'low',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Open Graph URL',
          section: 'seo',
          summary: 'Adds og:url for social sharing.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-og-type',
    title: 'Missing Open Graph type',
    severity: 'low',
    detect: (s) => !s.seoFacts.hasOgTitle, // proxy
    buildFix: (s) => {
      const snippet = `<meta property="og:type" content="website">`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-og-type-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-og-type',
        fixType: 'meta_tag',
        title: 'Add Open Graph type',
        summary: 'Marks the page as a website for social media embeds.',
        issueId: 'seo-og-type',
        issueTitle: 'Missing Open Graph type',
        issueSeverity: 'low',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Open Graph type',
          section: 'seo',
          summary: 'Adds og:type for social sharing.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-twitter-card',
    title: 'Missing Twitter/X card',
    severity: 'medium',
    detect: (s) => !s.seoFacts.hasTwitterCard,
    buildFix: (s) => {
      const title = s.seoFacts.pageTitle || s.seoFacts.h1Text;
      const desc = s.seoFacts.metaDescription;

      const parts: string[] = [
        `<meta name="twitter:card" content="summary_large_image">`,
      ];
      if (title) parts.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
      if (desc) parts.push(`<meta name="twitter:description" content="${escapeAttr(desc.slice(0, 200))}">`);

      const snippet = parts.join('\n');

      const connectorId = `seo-twitter-card-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-twitter-card',
        fixType: 'head_snippet',
        title: 'Add Twitter/X card tags',
        summary: 'Enables rich preview cards when this page is shared on Twitter/X.',
        issueId: 'seo-twitter-card',
        issueTitle: 'Missing Twitter/X card tags',
        issueSeverity: 'medium',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Twitter/X card tags',
          section: 'seo',
          summary: 'Adds twitter:card and related meta tags.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-website-schema',
    title: 'Missing WebSite structured data',
    severity: 'medium',
    detect: (s) => !s.seoFacts.hasWebsiteSchema,
    buildFix: (s) => {
      const name = s.seoFacts.orgName || s.seoFacts.pageTitle || 'Website';
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name,
        url: s.siteUrl,
      };

      const snippet = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-website-schema-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-website-schema',
        fixType: 'json_ld',
        title: 'Add WebSite structured data',
        summary: 'Adds WebSite JSON-LD schema to help search engines understand the site.',
        issueId: 'seo-website-schema',
        issueTitle: 'Missing WebSite structured data',
        issueSeverity: 'medium',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add WebSite schema',
          section: 'seo',
          summary: 'Adds JSON-LD WebSite schema for search engines.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },

  {
    id: 'seo-organization-schema',
    title: 'Missing Organization structured data',
    severity: 'medium',
    detect: (s) => !s.seoFacts.hasOrganizationSchema && !!s.seoFacts.orgName,
    buildFix: (s) => {
      const name = s.seoFacts.orgName;
      // Only generate if we have a confirmed org name — never invent it
      if (!name) return null;

      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        url: s.siteUrl,
      };

      const snippet = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
      if (!validateSnippet(snippet).valid) return null;

      const connectorId = `seo-organization-schema-${randomUUID().slice(0, 8)}`;
      return {
        fixId: 'seo-organization-schema',
        fixType: 'json_ld',
        title: 'Add Organization structured data',
        summary: 'Adds Organization JSON-LD schema using verified site information.',
        issueId: 'seo-organization-schema',
        issueTitle: 'Missing Organization structured data',
        issueSeverity: 'medium',
        connectorFix: {
          id: connectorId,
          fixType: 'code',
          title: 'Add Organization schema',
          section: 'seo',
          summary: 'Adds JSON-LD Organization schema for search engines and AI answer systems.',
          snippet,
        },
        rollbackPayload: { action: 'delete_fix', fixId: connectorId },
      };
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Select the next SEO issue to fix, skipping already-attempted issues.
 */
export function selectNextSeoIssue(
  snapshot: SiteSnapshot,
  attemptedIssueIds: string[],
): { issue: SeoIssue; fixPlan: FixPlan } | null {
  const attempted = new Set(attemptedIssueIds);

  for (const issue of SEO_ISSUES) {
    if (attempted.has(issue.id)) continue;
    if (!issue.detect(snapshot)) continue;

    const fixPlan = issue.buildFix(snapshot);
    if (!fixPlan) continue; // Can't build fix (missing facts) — skip

    return { issue, fixPlan };
  }

  return null;
}

/**
 * Extract SEO facts from a scan summary's findings/scores for the snapshot.
 */
export function extractSeoFacts(
  siteUrl: string,
  scores: Record<string, number>,
  findings: unknown[],
): SiteSnapshot['seoFacts'] {
  const facts: SiteSnapshot['seoFacts'] = {};

  // Walk findings for presence flags
  for (const f of findings ?? []) {
    const finding = f as Record<string, unknown>;
    const id = String(finding.id ?? '');
    const passed = !!finding.passed;

    if (id.includes('title') && passed) {
      if (finding.content) facts.pageTitle = String(finding.content);
    }
    if (id.includes('description') || id.includes('meta-description')) {
      if (passed && finding.content) facts.metaDescription = String(finding.content);
    }
    if (id.includes('canonical') && passed) facts.hasCanonical = true;
    if (id.includes('og:title') || id.includes('og_title')) {
      facts.hasOgTitle = passed;
    }
    if (id.includes('og:description') || id.includes('og_description')) {
      facts.hasOgDescription = passed;
    }
    if (id.includes('og:image') || id.includes('og_image')) {
      facts.hasOgImage = passed;
    }
    if (id.includes('twitter') && passed) facts.hasTwitterCard = true;
    if ((id.includes('Organization') || id.includes('organization')) && passed) {
      facts.hasOrganizationSchema = true;
    }
    if ((id.includes('WebSite') || id.includes('website-schema')) && passed) {
      facts.hasWebsiteSchema = true;
    }
    if ((id.includes('faq') || id.includes('FAQ')) && passed) {
      facts.hasFaqSchema = true;
    }

    // Extract org name from site_name finding
    if ((id.includes('site_name') || id.includes('og-site-name')) && finding.content) {
      facts.orgName = String(finding.content);
    }
  }

  return facts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
