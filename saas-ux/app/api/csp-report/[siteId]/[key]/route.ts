// app/api/csp-report/[siteId]/[key]/route.ts
//
// Public endpoint browsers send CSP violation reports to. The key is an HMAC of
// the site id, so only the address GetSafe 360 put into the site's policy works.
// Stored per report: directive, blocked origin or keyword, one page path, count.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { isValidReportKey, normalizeReports, storeViolations } from '@/lib/security/csp/reports';

export const runtime = 'nodejs';

const MAX_BODY = 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, props: { params: Promise<{ siteId: string; key: string }> }) {
  const { siteId, key } = await props.params;
  // Browsers ignore the response; never tell a prober which part was wrong.
  const done = new NextResponse(null, { status: 204 });
  if (!UUID.test(siteId)) return done;
  try {
    if (!isValidReportKey(siteId, key)) return done;
  } catch {
    return done;
  }

  const limit = await rateLimit(`csp-report:${siteId}`, 600, 60_000);
  if (!limit.ok) return done;

  const text = await request.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return done;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done;
  }
  try {
    await storeViolations(siteId, normalizeReports(body));
  } catch (error) {
    console.warn('[csp-report] store failed:', error instanceof Error ? error.message : error);
  }
  return done;
}
