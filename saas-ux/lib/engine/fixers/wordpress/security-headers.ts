// lib/engine/fixers/wordpress/security-headers.ts
//
// Sends missing HTTP security headers through the connector (≥1.5) and
// verifies them from the outside, exactly as a browser or scanner sees them.

import {
  HEADER_FIX_VALUES,
  SECURITY_HEADERS_FIXER_ID,
  buildSecurityHeadersPayload,
} from '@/lib/engine/security/headers';
import type { WordPressSecurityHeadersPayload } from '@/lib/wordpress/types';
import { type ConnectorFixer, type VerificationCheck, verificationResult } from '../types';

const USER_AGENT = 'GetSafe360-WordPressVerifier/1.0';

function readHeaders(payload: Record<string, unknown>): Record<string, string> {
  const headers = (payload.headers ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export const securityHeadersFixer: ConnectorFixer = {
  id: SECURITY_HEADERS_FIXER_ID,
  executor: 'wp-connector',

  plan(findings) {
    const findingIds = findings.map((finding) => finding.id).filter((id) => id in HEADER_FIX_VALUES);
    const headers = buildSecurityHeadersPayload(findingIds);
    const names = Object.keys(headers);
    if (names.length === 0) return null;

    const includesHsts = 'Strict-Transport-Security' in headers;
    return {
      type: 'set_security_headers',
      title: `Add ${names.length} security header${names.length === 1 ? '' : 's'}`,
      description: includesHsts
        ? `Send ${names.join(', ')} on every page. Browsers remember HSTS for one year even if it is removed later, so the site must stay on HTTPS.`
        : `Send ${names.join(', ')} on every page. The previous header set is restored exactly on undo.`,
      // HSTS is sticky in browsers; the rest are low-risk and fully reversible.
      risk: includesHsts ? 'medium' : 'low',
      autoApplyEligible: true,
      requiresApproval: false,
      requiredCapabilities: ['securityHeaders'],
      verification: {
        kind: 'api',
        expectation: 'A fresh request to the site returns each header with the configured value.',
        assertions: names.map((name) => `${name}: ${headers[name]}`),
      },
      payload: { headers, findingIds },
    };
  },

  toConnectorRequest(action) {
    const headers = readHeaders(action.payload);
    if (Object.keys(headers).length === 0) return null;
    const payload: WordPressSecurityHeadersPayload = { headers };
    return { id: action.id, type: 'set_security_headers', payload };
  },

  async verify(context) {
    const expected = readHeaders(context.action.payload);
    const doFetch = context.fetchImpl ?? fetch;
    const url = new URL(context.siteUrl);
    // Bypass page caches that would otherwise serve a response cached before the change.
    url.searchParams.set('gs360_verify', String(Date.now()));

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        redirect: 'follow',
        cache: 'no-store',
        headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
      });
    } catch (error) {
      return verificationResult([
        {
          name: 'security-headers:fetch',
          ok: false,
          detail: error instanceof Error ? error.message : 'Could not reach the site to verify headers.',
        },
      ]);
    }

    const checks: VerificationCheck[] = Object.entries(expected).map(([name, value]) => {
      const actual = response.headers.get(name);
      const ok = actual !== null && actual.toLowerCase().includes(value.toLowerCase());
      return {
        name: `security-header:${name.toLowerCase()}`,
        ok,
        detail: ok
          ? `${name}: ${actual}`
          : actual === null
            ? `${name} is missing from the live response. If the site uses a page cache or CDN, purge it and re-run the check.`
            : `${name} is "${actual}", expected "${value}". Another plugin or the server may set it first.`,
      };
    });

    return verificationResult(checks);
  },
};
