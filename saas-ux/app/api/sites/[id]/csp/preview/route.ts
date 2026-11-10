// app/api/sites/[id]/csp/preview/route.ts
//
// POST: scans the homepage and a few inner pages and proposes a starting policy.

import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { parseCsp } from '@/lib/security/csp/policy';
import { scanSitePages } from '@/lib/security/csp/scan';
import { policyFromScan } from '@/lib/security/csp/start';
import { createWordPressClient } from '@/lib/wordpress/client';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export const maxDuration = 60;

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId);
  if ('error' in access) return access.error;

  const limit = await rateLimit(`csp-preview:${siteId}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });

  const scan = await scanSitePages(access.site.siteUrl);
  if (scan.pages.length === 0) {
    return NextResponse.json({ success: false, error: 'SITE_UNREACHABLE' }, { status: 502 });
  }

  let connectorReady = false;
  if (access.tokenHash) {
    try {
      const client = createWordPressClient({ siteUrl: access.site.siteUrl, tokenHash: access.tokenHash, timeout: 10_000 });
      connectorReady = Boolean((await client.getCapabilities()).capabilities?.securityCsp);
    } catch {
      connectorReady = false;
    }
  }

  const policy = policyFromScan(siteId, access.site.siteUrl, scan.pages.map((page) => page.resources));
  return NextResponse.json(
    {
      success: true,
      policy,
      directives: parseCsp(policy),
      pages: scan.pages.map((page) => page.url),
      current: scan.current,
      connectorReady,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
