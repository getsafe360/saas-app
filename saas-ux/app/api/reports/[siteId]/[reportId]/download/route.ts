// app/api/reports/[siteId]/[reportId]/download/route.ts
//
// GET: streams a stored report to its owner as a file download.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { generatedReports } from '@/lib/db/schema';
import { reportContext } from '@/lib/reports/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only files our own generator stored are fetched.
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

export async function GET(_request: NextRequest, props: { params: Promise<{ siteId: string; reportId: string }> }) {
  const { siteId, reportId } = await props.params;
  const notFound = NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
  if (!UUID.test(reportId)) return notFound;
  const context = await reportContext(siteId);
  if (!context) return notFound;

  const [report] = await getDb()
    .select({ blobUrl: generatedReports.blobUrl, filename: generatedReports.filename, format: generatedReports.format, status: generatedReports.status })
    .from(generatedReports)
    .where(and(eq(generatedReports.id, reportId), eq(generatedReports.siteId, siteId)))
    .limit(1);
  if (!report?.blobUrl || report.status !== 'completed') return notFound;

  let url: URL;
  try {
    url = new URL(report.blobUrl);
  } catch {
    return notFound;
  }
  if (url.protocol !== 'https:' || !BLOB_HOST.test(url.hostname)) return notFound;

  const upstream = await fetch(url, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) return notFound;

  const filename = (report.filename ?? `report.${report.format === 'markdown' ? 'md' : 'pdf'}`).replace(/[^\w.-]/g, '-');
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': report.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
