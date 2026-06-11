// lib/optimization/fixes/verifyFix.ts
// Verify that an applied fix is live on the page

import type { FixPlan } from '../loops/types';
import type { ApplyFixResult } from './applyFix';

export interface VerifyFixInput {
  siteUrl: string;
  fixPlan: FixPlan;
  applyResult: ApplyFixResult;
}

export interface VerifyFixResult {
  passed: boolean;
  httpStatus?: number;
  snippetFound?: boolean;
  errorText?: boolean;
  reason?: string;
}

const FATAL_ERROR_PATTERNS = [
  /fatal error/i,
  /parse error/i,
  /call to undefined function/i,
  /wordpress database error/i,
  /there has been a critical error/i,
];

export async function verifyFix(input: VerifyFixInput): Promise<VerifyFixResult> {
  const { siteUrl, fixPlan, applyResult } = input;

  // If application already failed, skip network verification
  if (!applyResult.success) {
    return { passed: false, reason: 'Fix was not applied — skipping verification.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(siteUrl, {
      headers: { 'User-Agent': 'GetSafe360-Verifier/1.0' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const httpStatus = response.status;

    if (httpStatus !== 200) {
      return {
        passed: false,
        httpStatus,
        reason: `Page returned HTTP ${httpStatus} after fix.`,
      };
    }

    const html = await response.text();

    // Check for WordPress fatal error markers
    const hasError = FATAL_ERROR_PATTERNS.some((p) => p.test(html));
    if (hasError) {
      return {
        passed: false,
        httpStatus,
        errorText: true,
        reason: 'Page shows an error message after fix — possible regression.',
      };
    }

    // Check if the snippet we injected is present in the HTML
    const snippet = fixPlan.connectorFix.snippet;
    let snippetFound = false;

    if (snippet) {
      // For multi-line snippets, check the first meaningful tag
      const firstTag = snippet.trim().split('\n')[0].trim();
      // Check a distinctive substring (attribute + start of value)
      const checkStr = extractCheckString(firstTag);
      snippetFound = checkStr ? html.includes(checkStr) : true;
    } else {
      snippetFound = true; // Nothing to verify (manual/config fix)
    }

    if (!snippetFound) {
      return {
        passed: false,
        httpStatus,
        snippetFound: false,
        reason: 'Snippet was not found in page HTML — may not have been applied.',
      };
    }

    return { passed: true, httpStatus, snippetFound: true };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { passed: false, reason: 'Verification request timed out.' };
    }
    return { passed: false, reason: err?.message ?? 'Verification failed.' };
  }
}

function extractCheckString(tag: string): string | null {
  // For <meta name="description" content="..."> extract 'name="description"'
  // For <link rel="canonical" ...> extract 'rel="canonical"'
  // For <script type="application/ld+json"> extract 'application/ld+json'
  // For <meta property="og:title" ...> extract 'og:title'

  const propertyMatch = tag.match(/property="([^"]+)"/);
  if (propertyMatch) return `property="${propertyMatch[1]}"`;

  const nameMatch = tag.match(/name="([^"]+)"/);
  if (nameMatch) return `name="${nameMatch[1]}"`;

  const relMatch = tag.match(/rel="([^"]+)"/);
  if (relMatch) return `rel="${relMatch[1]}"`;

  if (tag.includes('application/ld+json')) return 'application/ld+json';

  return null;
}
