// app/api/connect/handshake/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites';
import { and, eq, sql } from 'drizzle-orm';
import { generateSiteToken, hashToken, createWordPressConnection } from '@/lib/wordpress/auth';
import { logPairingComplete, logConnectionError } from '@/lib/wordpress/logger';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
function jsonNoStore(body: Record<string, unknown>, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

// Keep POST only. /api/connect/check handles the GET polling.
export async function GET() {
  return jsonNoStore({ error: 'method_not_allowed' }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonNoStore({ error: 'invalid_json', code: 'E_JSON' }, { status: 400 });
    }

    const { pairCode, siteUrl, wpVersion, pluginVersion } = (payload ?? {}) as {
      pairCode?: string;
      siteUrl?: string;
      wpVersion?: string;
      pluginVersion?: string;
    };

    if (!pairCode || !/^\d{6}$/.test(pairCode)) {
      return jsonNoStore({ error: 'pairCode required', code: 'E_CODE' }, { status: 400 });
    }
    if (!siteUrl) {
      return jsonNoStore({ error: 'siteUrl required', code: 'E_URL' }, { status: 400 });
    }

    // Load pairing record created by /api/connect/start
    let recBlobUrl: string | null = null;
    try {
      const { blobs } = await list({ prefix: `pairings/code-${pairCode}.json`, limit: 1 });
      recBlobUrl = blobs[0]?.url ?? null;
    } catch (e) {
      console.error('[handshake] list error', e);
      return jsonNoStore({ error: 'pairing_lookup_failed', code: 'E_LIST' }, { status: 500 });
    }
    if (!recBlobUrl) {
      return jsonNoStore({ error: 'invalid_or_expired_code', code: 'E_NOT_FOUND' }, { status: 404 });
    }

    const recRes = await fetch(recBlobUrl, { cache: 'no-store' });
    if (!recRes.ok) {
      return jsonNoStore({ error: 'pairing_fetch_failed', code: 'E_FETCH' }, { status: 500 });
    }

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

    if (!record) {
      return jsonNoStore({ error: 'pairing_parse_failed', code: 'E_PARSE' }, { status: 500 });
    }

    const now = Date.now();
    if (record.used) {
      return jsonNoStore(
        record.siteId
          ? { error: 'already_used', code: 'E_USED', siteId: record.siteId }
          : { error: 'already_used', code: 'E_USED' },
        { status: 409 }
      );
    }
    if (record.expiresAt && now > record.expiresAt) {
      return jsonNoStore({ error: 'code_expired', code: 'E_EXPIRED' }, { status: 410 });
    }
    if (!record.userId) {
      // We require /api/connect/start to stamp userId; otherwise we can’t own the site row.
      return jsonNoStore({ error: 'missing_user_in_pair_record', code: 'E_NOUSER' }, { status: 500 });
    }

    // Normalize URL & resolve host
    const normalizedReq = normalizeInput(siteUrl);
    const normalizedRec = normalizeInput(record.siteUrl);
    const reqHost = hostOf(normalizedReq);
    const recHost = hostOf(normalizedRec);

    // Prefer the host we stored in /start (normalizedRec), but don’t block if they differ.
    const finalSiteUrl = normalizedRec || normalizedReq;
    const finalHost = recHost || reqHost;

    // DB upsert (reuse if this user already has a site with same host)
    const db = getDrizzle();

    // Try to find by same user + same host (case-insensitive match over siteUrl)
    // NOTE: since we don’t have a separate host column, compare lower(site_url) LIKE '%//host/%'.
    // This is a pragmatic guard; you can tighten this by storing host in its own column.
    const likePattern = `%//${finalHost}/%`;
    const existing = await db
      .select({ id: sites.id })
      .from(sites)
      .where(
        and(
          eq(sites.userId, record.userId!),
          sql`lower(${sites.siteUrl}) LIKE ${likePattern.toLowerCase()}`
        )
      )
      .limit(1);

    const reuseId = existing[0]?.id ?? record.siteId;
    const siteId = reuseId || crypto.randomUUID(); // Proper UUID format for PostgreSQL
    const siteToken = generateSiteToken(); // Use new secure token generator
    const tokenHash = hashToken(siteToken); // Use new hash function

    // Create WordPress connection metadata
    const wordpressConnection = createWordPressConnection({
      tokenHash,
      pluginVersion: pluginVersion || 'unknown',
      wpVersion: wpVersion || 'unknown',
      siteUrl: finalSiteUrl,
    });

    // Insert or update the site
    if (!existing[0]) {
      try {
        await db.insert(sites).values({
          id: siteId,
          userId: record.userId!,
          siteUrl: finalSiteUrl,
          connectionStatus: 'connected',
          cms: 'wordpress',
          wpVersion: wpVersion || null,
          pluginVersion: pluginVersion || null,
          tokenHash,
          wordpressConnection: wordpressConnection as any,
          lastConnectedAt: new Date(),
          // createdAt and updatedAt handled by defaultNow()
        });

        // Log successful pairing
        await logPairingComplete(siteId);
      } catch (e: any) {
        console.error('[handshake] insert sites failed', e);
        await logConnectionError(siteId, 'Database insert failed', 'error');
        return jsonNoStore({ error: 'db_insert_failed', code: 'E_DB_INSERT' }, { status: 500 });
      }
    } else {
      try {
        await db
          .update(sites)
          .set({
            siteUrl: finalSiteUrl,
            connectionStatus: 'connected',
            wpVersion: wpVersion || null,
            pluginVersion: pluginVersion || null,
            tokenHash,
            wordpressConnection: wordpressConnection as any,
            lastConnectedAt: new Date(),
            updatedAt: new Date() // Explicitly update timestamp on reconnect
          })
          .where(eq(sites.id, siteId));

        // Log successful re-pairing
        await logPairingComplete(siteId);
      } catch (e: any) {
        console.error('[handshake] update sites failed', e);
        await logConnectionError(siteId, 'Database update failed', 'error');
        return jsonNoStore({ error: 'db_update_failed', code: 'E_DB_UPDATE' }, { status: 500 });
      }
    }

    // Mark pairing used
    try {
      await put(
        `pairings/code-${pairCode}.json`,
        JSON.stringify({ ...record, used: true, usedAt: now, siteId }),
        { access: 'public', contentType: 'application/json' }
      );
    } catch (e) {
      console.error('[handshake] mark used failed', e);
      // Non-fatal for plugin experience—continue
    }

    // Optional: dashboard fallback blob
    try {
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
    } catch (e) {
      console.error('[handshake] write site blob failed', e);
    }

    return jsonNoStore({ siteId, siteToken });
  } catch (e: any) {
    console.error('[handshake] unhandled error', e);
    return jsonNoStore({ error: 'handshake_failed', code: 'E_UNCAUGHT' }, { status: 500 });
  }
}
