// app/api/connect/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

// ✅ DB check
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('pairCode')?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return jsonNoStore({ error: 'pairCode required' }, { status: 400 });
  }

  try {
    // Records are stored as: pairings/code-123456.json
    const { blobs } = await list({ prefix: `pairings/code-${code}.json`, limit: 1 });

    // No record at all → treat as expired/invalid
    if (!blobs.length) {
      return jsonNoStore({
        used: false,
        expired: true,
        status: 'expired',
        remainingMs: 0
      });
    }

    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) {
      // Graceful fallback: unknown → pending (client can retry)
      return jsonNoStore({ used: false, expired: false, status: 'pending' });
    }

    const record = (await res.json().catch(() => null)) as
      | { used?: boolean; siteId?: string; expiresAt?: number }
      | null;

    if (!record) {
      return jsonNoStore({ used: false, expired: false, status: 'pending' });
    }

    const now = Date.now();
    const expiresAt = record.expiresAt ?? 0;
    const remainingMs = Math.max(0, expiresAt - now);
    const expired = expiresAt ? now > expiresAt : false;

    if (record.used) {
      // ✅ When used, also verify the site exists in DB
      let dbConfirmed = false;

      if (record.siteId) {
        try {
          const db = getDb();
          const [row] = await db
            .select({ id: sites.id })
            .from(sites)
            .where(eq(sites.id, record.siteId))
            .limit(1);
          dbConfirmed = !!row?.id;
        } catch {
          // Don’t fail the whole check on DB hiccups
          dbConfirmed = false;
        }
      }

      return jsonNoStore({
        used: true,
        expired: false,
        status: 'used',
        siteId: record.siteId,
        canonicalSiteId: dbConfirmed ? record.siteId : undefined,
        dbConfirmed,
        remainingMs
      });
    }

    if (expired) {
      return jsonNoStore({
        used: false,
        expired: true,
        status: 'expired',
        remainingMs: 0
      });
    }

    // Still waiting for handshake
    return jsonNoStore({
      used: false,
      expired: false,
      status: 'pending',
      remainingMs
    });
  } catch {
    // Don’t leak details; let client keep polling
    return jsonNoStore({ used: false, expired: false, status: 'pending' });
  }
}

function jsonNoStore(
  body: Record<string, unknown>,
  init?: ResponseInit
) {
  const res = NextResponse.json(body, init);
  // Make sure intermediate caches never stick this
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
