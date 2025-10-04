// app/api/connect/handshake/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import crypto from 'crypto';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- helpers ---
function normalizeInput(u: string): string {
  try {
    const url = new URL(u);
    url.search = '';
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === '' || url.pathname === '/') url.pathname = '/';
    return url.toString();
  } catch {
    return u;
  }
}

function jsonNoStore(body: Record<string, unknown>, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

// For clarity: handshake should be POST only
export async function GET() {
  return jsonNoStore({ error: 'method not allowed' }, { status: 405 });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonNoStore({ error: 'invalid_json' }, { status: 400 });
  }

  const { pairCode, siteUrl, wpVersion, pluginVersion } = (payload ?? {}) as {
    pairCode?: string;
    siteUrl?: string;
    wpVersion?: string;
    pluginVersion?: string;
  };

  if (!pairCode || !/^\d{6}$/.test(pairCode)) {
    return jsonNoStore({ error: 'pairCode required' }, { status: 400 });
  }
  if (!siteUrl) {
    return jsonNoStore({ error: 'siteUrl required' }, { status: 400 });
  }

  // Load pairing record from Blob
  const { blobs } = await list({ prefix: `pairings/code-${pairCode}.json`, limit: 1 });
  if (!blobs.length) {
    return jsonNoStore({ error: 'invalid_or_expired_code' }, { status: 404 });
  }

  const recRes = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!recRes.ok) return jsonNoStore({ error: 'pairing_lookup_failed' }, { status: 500 });

  const record = (await recRes.json().catch(() => null)) as
    | {
        id: string;
        siteUrl: string;
        pairCode: string;
        createdAt: number;
        expiresAt: number;
        used: boolean;
        userId?: number; // set in /api/connect/start
        siteId?: string;
      }
    | null;

  if (!record) return jsonNoStore({ error: 'pairing_parse_failed' }, { status: 500 });

  const now = Date.now();
  if (record.used) {
    // Already paired: return existing site if present
    return jsonNoStore(
      record.siteId
        ? { error: 'already_used', siteId: record.siteId }
        : { error: 'already_used' },
      { status: 409 }
    );
  }
  if (record.expiresAt && now > record.expiresAt) {
    return jsonNoStore({ error: 'code_expired' }, { status: 410 });
  }
  if (!record.userId) {
    // Should be set by /api/connect/start; required to link site owner
    return jsonNoStore({ error: 'missing_user_in_pair_record' }, { status: 500 });
  }

  // Normalize URL and prefer record’s normalized origin if needed
  const normalized = normalizeInput(siteUrl);
  const normalizedFromRecord = normalizeInput(record.siteUrl);

  // (Optional) sanity check host equality; if different, still proceed with record’s URL
  const reqHost = (() => {
    try { return new URL(normalized).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();
  const recHost = (() => {
    try { return new URL(normalizedFromRecord).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  const finalSiteUrl = recHost && reqHost && recHost !== reqHost ? normalizedFromRecord : normalized;

  // Generate IDs/secrets
  const siteId = record.siteId || crypto.randomBytes(8).toString('hex'); // 16 hex chars like your earlier examples
  const siteToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(siteToken).digest('hex');

  // Upsert site in DB
  const db = getDb();

  // Check if site row already exists
  const [existing] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);

  if (!existing) {
    // Insert new site
    try {
      await db.insert(sites).values({
        id: siteId,
        userId: record.userId!, // NOT NULL in your schema
        siteUrl: finalSiteUrl,
        status: 'connected',
        cms: 'wordpress',
        wpVersion: wpVersion || null,
        pluginVersion: pluginVersion || null,
        tokenHash,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
    } catch (e) {
      // If a race created it in parallel, continue
    }
  } else {
    // Update token & meta (optional)
    try {
      await db
        .update(sites)
        .set({
          siteUrl: finalSiteUrl,
          status: 'connected',
          wpVersion: wpVersion || existing.wpVersion || null,
          pluginVersion: pluginVersion || existing.pluginVersion || null,
          tokenHash,
          updatedAt: new Date()
        } as any)
        .where(eq(sites.id, siteId));
    } catch {}
  }

  // Mark the pairing as used and stamp the siteId
  const updatedRecord = {
    ...record,
    used: true,
    usedAt: now,
    siteId
  };
  await put(`pairings/code-${pairCode}.json`, JSON.stringify(updatedRecord), {
    access: 'public',
    contentType: 'application/json'
  });

  // Optional: write a small site blob for the dashboard fallback
  await put(
    `sites/${siteId}.json`,
    JSON.stringify({
      siteId,
      siteUrl: finalSiteUrl,
      status: 'connected',
      wpVersion: wpVersion || null,
      pluginVersion: pluginVersion || null,
      createdAt: now,
      updatedAt: now
    }),
    { access: 'public', contentType: 'application/json' }
  );

  // Return credentials to the plugin
  return jsonNoStore({
    siteId,
    siteToken
  });
}
