// app/api/scan/result/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { scanJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { list, type ListBlobResultBlob } from '@vercel/blob';

const DEV = process.env.NODE_ENV !== 'production';

async function readReportBlob(key: string): Promise<any | null> {
  const { blobs } = await list({ prefix: key });
  const match = blobs.find(b => b.pathname === key) || blobs[0];
  if (!match) return null;
  const r = await fetch(match.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  return j;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const [job] = await db.select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });

  const key = job.reportBlobKey || `scan-results/${id}.json`;

  try {
    const data = await readReportBlob(key);
    if (!data?.report) {
      // Not ready yet (race between marking done and blob availability)
      return NextResponse.json(
        { ok: false, notReady: true, error: 'report blob missing', key, status: job.status },
        { status: 202 }
      );
    }
    return NextResponse.json({ ok: true, report: data.report, key });
  } catch (e: any) {
    if (DEV) console.error('[scan/result] read error', e);
    return NextResponse.json(
      { ok: false, error: 'failed to read result', message: String(e?.message ?? e), key },
      { status: 500 }
    );
    }
}
