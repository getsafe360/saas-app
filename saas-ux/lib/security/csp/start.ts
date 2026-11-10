// lib/security/csp/start.ts
//
// Policy preparation shared by the preview and start routes: build from the
// scan (or take the reviewed policy), always pointing reports at GetSafe 360.

import { reportBaseUrl, reportUriFor } from './reports';
import { buildCspPolicy, parseCsp, serializeCsp, validateCsp, type PageResources } from './policy';

export const CSP_TEST_ACTION_ID = 'security-csp-report-only';
export const CSP_TEST_HEADER = 'Content-Security-Policy-Report-Only';

export function reportHosts(): string[] {
  return [new URL(reportBaseUrl()).hostname];
}

export function policyFromScan(siteId: string, siteUrl: string, pages: ReadonlyArray<PageResources>): string {
  return serializeCsp(buildCspPolicy({ siteUrl, pages, reportUri: reportUriFor(siteId) }));
}

/** A reviewed policy, with report-uri forced to this site's GetSafe 360 address. Null when invalid. */
export function preparePolicy(siteId: string, value: string): string | null {
  const policy = parseCsp(value);
  policy['report-uri'] = [reportUriFor(siteId)];
  const header = serializeCsp(policy);
  return validateCsp(header, reportHosts()).ok ? header : null;
}
