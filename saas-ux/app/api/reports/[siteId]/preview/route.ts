// app/api/reports/[siteId]/preview/route.ts
//
// GET ?locale=&periodDays=&whiteLabel= : the report as an HTML page, for the
// preview on the Reports page. Not stored and not counted against the quota.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { canReport, parseReportOptions, renderReport, reportContext } from '@/lib/reports/service';

export async function GET(request: NextRequest, props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await props.params;
  const context = await reportContext(siteId);
  if (!context) return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  if (!canReport(context.plan)) return NextResponse.json({ success: false, error: 'UPGRADE_REQUIRED' }, { status: 403 });

  const limited = await rateLimit(`report-preview:${siteId}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });

  const options = parseReportOptions(Object.fromEntries(request.nextUrl.searchParams), 'en');
  const { html } = await renderReport(context, options);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // Static page: no scripts and no outside requests (the logo is embedded).
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
    },
  });
}
