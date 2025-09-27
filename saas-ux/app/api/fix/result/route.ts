// app/api/fix/result/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { list } from '@vercel/blob';

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'fix_job_not_found' }, { status: 404 });

  const key = job.resultBlobKey || `fix-results/${id}.json`;

  const { blobs } = await list({ prefix: key });
  const match = blobs.find(b => b.pathname === key) || blobs[0];
  if (!match) return NextResponse.json({ ok: false, error: 'not_ready' }, { status: 202 });

  const r = await fetch(match.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!j) return NextResponse.json({ ok: false, error: 'read_error' }, { status: 500 });

  return NextResponse.json({ ok: true, result: j });
}
