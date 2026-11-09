// app/api/sites/[id]/csp/route.ts
//
// GET: the site's CSP test (policy, start date) and the violations reported so far.

import { NextResponse } from 'next/server';
import { readTestState, readViolations } from '@/lib/security/csp/reports';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId);
  if ('error' in access) return access.error;

  const [state, violations] = await Promise.all([readTestState(siteId), readViolations(siteId)]);
  return NextResponse.json(
    {
      success: true,
      state,
      violations: violations.slice(0, 100),
      totalReports: violations.reduce((sum, entry) => sum + entry.count, 0),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
