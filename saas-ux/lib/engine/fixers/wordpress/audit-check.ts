// lib/engine/fixers/wordpress/audit-check.ts
//
// Verification through the connector's read-only audit: after a change, ask
// WordPress itself whether the setting now reads as expected.

import { parseWordPressAudit, type WordPressAuditResponse } from '@/lib/wordpress/audit-types';
import { createWordPressClient } from '@/lib/wordpress/client';
import type { FixerVerifyContext, VerificationCheck } from '../types';

export interface AuditExpectation {
  name: string;
  /** true = as expected, false = not yet, null = the audit does not report it. */
  test(audit: WordPressAuditResponse): boolean | null;
  ok: string;
  failed: string;
}

export async function auditChecks(
  context: FixerVerifyContext,
  expectations: ReadonlyArray<AuditExpectation>,
): Promise<VerificationCheck[]> {
  let audit: WordPressAuditResponse | null = null;
  try {
    const client = createWordPressClient({ siteUrl: context.siteUrl, tokenHash: context.tokenHash, timeout: 15000 });
    audit = parseWordPressAudit(await client.audit());
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The site audit could not be read.';
    return expectations.map((expectation) => ({ name: expectation.name, ok: false, detail }));
  }
  if (!audit) {
    return expectations.map((expectation) => ({
      name: expectation.name,
      ok: false,
      detail: 'The connector did not return a site audit.',
    }));
  }
  return expectations.map((expectation) => {
    const result = expectation.test(audit!);
    return {
      name: expectation.name,
      ok: result === true,
      detail: result === null ? 'The connector does not report this value.' : result ? expectation.ok : expectation.failed,
    };
  });
}
