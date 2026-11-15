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
  // Page-specific tags (meta description, canonical, Open Graph, Twitter) are deliberately not
  // here: the connector prints every stored snippet on every page, so one written from the home
  // page would claim every page is the home page (a site-wide canonical can drop pages from the
  // index). Those come from per-page connector features instead (set_seo_meta, social tags).
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
  // Never guess at missing tags: with unverified facts an empty object looks like "nothing present".
  if (snapshot.seoFactsVerified === false) return null;

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
