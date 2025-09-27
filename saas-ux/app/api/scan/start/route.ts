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
const ALLOWED_CATEGORIES: readonly Category[] = [
  'seo',
  'performance',
  'accessibility',
  'security'
] as const;

const DEV = process.env.NODE_ENV !== 'production';

function res(
  status: number,
  body: Record<string, any>,
  requestId: string
): NextResponse {
  return NextResponse.json(
    DEV ? body : { ok: body.ok, error: body.error, jobId: body.jobId },
    {
      status,
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store'
      }
    }
  );
}

function devErr(e: unknown) {
  if (!DEV) return undefined;
  const err = e as any;
  return {
    name: err?.name,
    message: err?.message,
    stack: err?.stack
  };
}

async function getSiteFromBlob(id: string): Promise<{ siteId: string; siteUrl: string } | null> {
  try {
    const { blobs } = await list({ prefix: `sites/${id}.json` });
    const b = blobs?.[0] as ListBlobResultBlob | undefined;
    if (!b) return null;
    const r = await fetch(b.url, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j || !j.siteId || !j.siteUrl) return null;
    return { siteId: j.siteId, siteUrl: j.siteUrl };
  } catch (e) {
    if (DEV) console.error('[scan/start] blob fetch error:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const requestId = crypto.randomUUID();
  const steps: Array<{ step: string; ms: number; note?: string; ok?: boolean }> = [];
  const mark = (step: string, note?: string, ok?: boolean) => {
    steps.push({ step, ms: Date.now() - t0, note, ok });
  };

  const db = getDb();

  // ---- Parse & validate payload
  let payload: unknown;
  try {
    payload = await req.json();
    mark('parse_json', undefined, true);
  } catch (e) {
    mark('parse_json', 'invalid json', false);
    return res(
      400,
      { ok: false, error: { code: 'BAD_JSON', message: 'Invalid JSON body' }, debug: { steps, err: devErr(e) } },
      requestId
    );
  }

  const { siteId, categories } = (payload as { siteId?: string; categories?: Category[] }) ?? {};
  if (!siteId) {
    mark('validate', 'missing siteId', false);
    return res(
      400,
      { ok: false, error: { code: 'SITE_ID_REQUIRED', message: 'siteId required' }, debug: { steps } },
      requestId
    );
  }

  // Validate categories, but be helpful
  let cats: Category[] = Array.isArray(categories) && categories.length ? categories : [...ALLOWED_CATEGORIES];
  const invalidCats = cats.filter(c => !ALLOWED_CATEGORIES.includes(c));
  if (invalidCats.length) {
    mark('validate', 'invalid categories', false);
    return res(
      400,
      {
        ok: false,
        error: { code: 'INVALID_CATEGORIES', message: 'One or more categories are invalid' },
        debug: { steps, invalid: invalidCats, allowed: ALLOWED_CATEGORIES }
      },
      requestId
    );
  }

  // ---- Look up site (DB first)
  let siteUrl: string | null = null;
  let source: 'db' | 'blob' | 'none' = 'none';

  try {
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
    source = siteUrl ? 'db' : 'none';
    mark('db_lookup', siteUrl ? 'hit' : 'miss', !!siteUrl);
  } catch (e) {
    mark('db_lookup', 'error', false);
    if (DEV) console.error(`[scan/start] ${requestId} DB lookup error`, e);
  }

  // ---- Fallback to Blob (align with page data source)
  if (!siteUrl) {
    const blob = await getSiteFromBlob(siteId);
    if (blob) {
      siteUrl = blob.siteUrl;
      source = 'blob';
      mark('blob_lookup', 'hit', true);

      // Optional: upsert stub site to satisfy FK constraints later
      try {
        // If your dialect supports it, keep onConflictDoNothing();
        // Otherwise, wrap in try/catch like below to ignore duplicates.
        await db
          .insert(sites)
          .values({
            id: siteId,
            siteUrl: blob.siteUrl,
            status: 'connected',
            createdAt: new Date(),
            updatedAt: new Date()
          } as any)
          // @ts-ignore drizzle's onConflictDoNothing availability depends on the driver
          .onConflictDoNothing?.();
        mark('site_upsert', 'inserted (or skipped by conflict)', true);
      } catch (e) {
        mark('site_upsert', 'failed (non-fatal)', false);
        if (DEV) console.warn(`[scan/start] ${requestId} site upsert failed (likely OK if already exists)`, e);
      }
    } else {
      mark('blob_lookup', 'miss', false);
    }
  }

  if (!siteUrl) {
    return res(
      404,
      {
        ok: false,
        error: { code: 'SITE_NOT_FOUND', message: 'Site not found in DB or Blob' },
        debug: { steps, siteId, sourceTried: ['db', 'blob'] }
      },
      requestId
    );
  }

  // ---- Enqueue job
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
    mark('enqueue_job', 'queued', true);
  } catch (e: any) {
    mark('enqueue_job', 'failed', false);

    // Offer a precise hint if this is a FK / constraint issue
    const msg = String(e?.message ?? e);
    const isFK = /foreign key|constraint|references/i.test(msg);
    const code = isFK ? 'FK_VIOLATION' : 'ENQUEUE_FAILED';

    if (DEV) {
      console.error(`[scan/start] ${requestId} enqueue error`, e);
    }

    return res(
      500,
      {
        ok: false,
        error: {
          code,
          message: isFK
            ? 'Failed to enqueue: siteId does not exist in sites table (FK). Consider enabling site upsert.'
            : 'Failed to enqueue job'
        },
        debug: { steps, dbMessage: msg, siteId, categories: cats }
      },
      requestId
    );
  }

  // ---- Success
  return res(
    200,
    {
      ok: true,
      jobId,
      info: { siteId, categories: cats, source },
      debug: DEV ? { steps, elapsedMs: Date.now() - t0 } : undefined
    },
    requestId
  );
}
