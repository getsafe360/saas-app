// lib/engine/security/headers.ts
//
// HTTP security header rule pack, shared by the WordPress checklist and the
// page checks (lib/engine/page) that the cockpit cards and the site scan use.
// The fix values here are the exact headers the connector will send.

import type { FixRef, Severity } from '../contracts';
import { type Rule, unknown } from '../rules';

/** The response headers checked, in report order. Wording is in messages/Findings. */
export const SECURITY_HEADERS: ReadonlyArray<{ header: string; id: string; severity: Severity }> = [
  { header: 'strict-transport-security', id: 'sec-hsts', severity: 'high' },
  { header: 'content-security-policy', id: 'sec-csp', severity: 'medium' },
  { header: 'x-content-type-options', id: 'sec-nosniff', severity: 'medium' },
  { header: 'referrer-policy', id: 'sec-referrer-policy', severity: 'low' },
  { header: 'x-frame-options', id: 'sec-frame-options', severity: 'medium' },
];

export interface SiteHeaderFacts {
  /** Final URL is HTTPS; null when not observed. */
  https: boolean | null;
  /** Lower-cased response headers of the page; null when not captured. */
  headers: Record<string, string> | null;
}

export const SECURITY_HEADERS_FIXER_ID = 'security-headers';

/** Header the connector sends to resolve each finding. */
export const HEADER_FIX_VALUES: Readonly<Record<string, { name: string; value: string }>> = {
  // No includeSubDomains: a subdomain without HTTPS would become unreachable.
  'sec-hsts': { name: 'Strict-Transport-Security', value: 'max-age=31536000' },
  'sec-nosniff': { name: 'X-Content-Type-Options', value: 'nosniff' },
  'sec-referrer-policy': { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  'sec-frame-options': { name: 'X-Frame-Options', value: 'SAMEORIGIN' },
};

function headerFix(findingId: string): FixRef | undefined {
  if (!(findingId in HEADER_FIX_VALUES)) return undefined;
  return {
    fixerId: SECURITY_HEADERS_FIXER_ID,
    automation: 'auto',
    // Browsers remember HSTS for max-age even after the header is removed, so
    // it is neither low-risk nor truly reversible. The others are.
    risk: findingId === 'sec-hsts' ? 'medium' : 'low',
    reversible: findingId !== 'sec-hsts',
    requiresCapabilities: ['securityHeaders'],
  };
}

const CSP_FIX: FixRef = { fixerId: 'security-csp', automation: 'guided', risk: 'medium', reversible: false };

export const SECURITY_HEADER_RULES: ReadonlyArray<Rule<SiteHeaderFacts>> = SECURITY_HEADERS.map((spec) => ({
  id: spec.id,
  category: 'security',
  severity: spec.severity,
  source: 'external-probe',
  fix: spec.id === 'sec-csp' ? CSP_FIX : headerFix(spec.id),
  evaluate: ({ https, headers }: SiteHeaderFacts) => {
    if (headers === null) return unknown('common.headersNotCaptured');

    const value = headers[spec.header];
    if (value) return { status: 'pass', message: 'common.headerSet', values: { header: spec.header }, observed: value };

    if (spec.header === 'x-frame-options' && /frame-ancestors/i.test(headers['content-security-policy'] ?? '')) {
      return {
        status: 'pass',
        message: 'frameAncestors',
        observed: headers['content-security-policy'],
      };
    }

    if (spec.header === 'strict-transport-security') {
      if (https === null) return unknown('httpsUnknown');
      if (!https) return { status: 'not-applicable', message: 'notApplicable' };
    }

    return { status: 'fail', message: 'missing' };
  },
}));

export function buildSiteHeaderFacts(apiData: Record<string, any> | null | undefined): SiteHeaderFacts {
  const raw = apiData?.headers;
  let headers: Record<string, string> | null = null;
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    headers = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') headers[key.toLowerCase()] = value;
    }
  }
  return {
    https: typeof apiData?.isHttps === 'boolean' ? apiData.isHttps : null,
    headers,
  };
}

/**
 * Connector payload for the selected header findings. Unknown ids are
 * ignored, so a stale selection can never send an unexpected header.
 */
export function buildSecurityHeadersPayload(findingIds: ReadonlyArray<string>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const id of findingIds) {
    const fix = HEADER_FIX_VALUES[id];
    if (fix) headers[fix.name] = fix.value;
  }
  return headers;
}
