// /app/api/scan/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/drizzle';
import { scanJobs, sites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { list, type ListBlobResultBlob } from '@vercel/blob';

type Category = 'seo' | 'performance' | 'accessibility' | 'security';

async function getSiteFromBlob(id: string): Promise<{ siteId: string; siteUrl: string } | null> {
  const { blobs } = await list({ prefix: `sites/${id}.json` });
  const b = blobs?.[0] as ListBlobResultBlob | undefined;
  if (!b) return null;
  const r = await fetch(b.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!j || !j.siteId || !j.siteUrl) return null;
  return { siteId: j.siteId, siteUrl: j.siteUrl };
}

export async function POST(req: NextRequest) {
  const db = getDb();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { siteId, categories } = (payload as { siteId?: string; categories?: Category[] }) ?? {};
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }

  const cats = (categories && categories.length
    ? categories
    : (['seo', 'performance', 'accessibility', 'security'] as Category[]));

  // 1) Try DB
  let siteUrl: string | null = null;
  try {
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
  } catch {
    // ignore db select errors
  }

  // 2) Fallback to Blob (keeps API behavior aligned with your page)
  if (!siteUrl) {
    const blob = await getSiteFromBlob(siteId);
    if (blob) {
      siteUrl = blob.siteUrl;

      // OPTIONAL: if scanJobs.siteId has an FK to sites.id, upsert a stub site
      // to satisfy the constraint. Uncomment if needed.
      // try {
      //   await db
      //     .insert(sites)
      //     .values({
      //       id: siteId,
      //       siteUrl: blob.siteUrl,
      //       status: 'connected',
      //       createdAt: new Date(),
      //       updatedAt: new Date()
      //     } as any)
      //     // @ts-ignore drizzle onConflict target depends on your dialect
      //     .onConflictDoNothing?.();
      // } catch {}
    }
  }

  if (!siteUrl) {
    return NextResponse.json({ error: 'site not found' }, { status: 404 });
  }

  const jobId = crypto.randomUUID();

  try {
    await db.insert(scanJobs).values({
      id: jobId,
      siteId,
      status: 'queued',
      categories: cats.join(','),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (e) {
    // If you have an FK and didn’t upsert the site above, this is where it would fail.
    return NextResponse.json({ error: 'failed to enqueue job' }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
