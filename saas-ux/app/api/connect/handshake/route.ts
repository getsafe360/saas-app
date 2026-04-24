// app/api/connect/handshake/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites';
import { and, eq } from 'drizzle-orm';
import { generateSiteToken, hashToken, createWordPressConnection } from '@/lib/wordpress/auth';
import { logPairingComplete, logConnectionError } from '@/lib/wordpress/logger';
import { put } from '@vercel/blob';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAIRING_TTL_SEC = 10 * 60;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function canonicalRootOf(u: string) {
  try {
    const url = new URL(u);
    return `${url.origin.toLowerCase()}/`;
  } catch {
    return '';
  }
}

function jsonNoStore(body: Record<string, unknown>, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

export async function GET() {
  return jsonNoStore({ error: 'method_not_allowed' }, { status: 405 });
}

export async function POST(req: NextRequest) {
  let claimKey: string | undefined;
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

    // Load pairing record from Redis
    const raw = await redis.get<string>(`pairing:code:${pairCode}`);
    if (!raw || raw === 'reserved') {
      return jsonNoStore({ error: 'invalid_or_expired_code', code: 'E_NOT_FOUND' }, { status: 404 });
    }

    let record: {
      id: string;
      siteUrl: string;
      pairCode: string;
      createdAt: number;
      expiresAt: number;
      used: boolean;
      userId?: number;
      siteId?: string;
    } | null = null;

    try {
      record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return jsonNoStore({ error: 'pairing_parse_failed', code: 'E_PARSE' }, { status: 500 });
    }

    if (!record) {
      return jsonNoStore({ error: 'pairing_parse_failed', code: 'E_PARSE' }, { status: 500 });
    }

    const now = Date.now();
    if (record.used) {
      return jsonNoStore(
        record.siteId
          ? { error: 'already_used', code: 'E_USED', siteId: record.siteId }
          : { error: 'already_used', code: 'E_USED' },
        { status: 409 },
      );
    }
    if (record.expiresAt && now > record.expiresAt) {
      return jsonNoStore({ error: 'code_expired', code: 'E_EXPIRED' }, { status: 410 });
    }
    if (!record.userId) {
      return jsonNoStore({ error: 'missing_user_in_pair_record', code: 'E_NOUSER' }, { status: 500 });
    }

    const normalizedReq = normalizeInput(siteUrl);
    const normalizedRec = normalizeInput(record.siteUrl);
    const finalSiteUrl = normalizedRec || normalizedReq;

    const canonicalHost = hostOf(finalSiteUrl);
    const canonicalRoot = canonicalRootOf(finalSiteUrl);

    if (!canonicalHost) {
      return jsonNoStore({ error: 'invalid_site_url', code: 'E_BAD_HOST' }, { status: 400 });
    }

    const db = getDrizzle();

    const existingByHost = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.userId, record.userId), eq(sites.canonicalHost, canonicalHost)))
      .limit(1);

    const existingByRecordId = !existingByHost[0] && record.siteId
      ? await db
          .select({ id: sites.id })
          .from(sites)
          .where(eq(sites.id, record.siteId))
          .limit(1)
      : [];

    const existingId = existingByHost[0]?.id ?? existingByRecordId[0]?.id;
    const siteId = existingId || crypto.randomUUID();

    const siteToken = generateSiteToken();
    const tokenHash = hashToken(siteToken);

    const wordpressConnection = createWordPressConnection({
      tokenHash,
      pluginVersion: pluginVersion || 'unknown',
      wpVersion: wpVersion || 'unknown',
      siteUrl: finalSiteUrl,
    });

    const updatePayload = {
      siteUrl: finalSiteUrl,
      canonicalHost,
      canonicalRoot,
      connectionStatus: 'connected' as const,
      cms: 'wordpress',
      wpVersion: wpVersion || null,
      pluginVersion: pluginVersion || null,
      tokenHash,
      wordpressConnection: wordpressConnection as any,
      lastConnectedAt: new Date(),
      updatedAt: new Date(),
    };

    // Atomically claim the code — only one concurrent request can proceed past this point
    claimKey = `pairing:claim:${pairCode}`;
    const claimed = await redis.set(claimKey, '1', { nx: true, ex: 60 });
    if (!claimed) {
      return jsonNoStore(
        record.siteId
          ? { error: 'already_used', code: 'E_USED', siteId: record.siteId }
          : { error: 'already_used', code: 'E_USED' },
        { status: 409 },
      );
    }

    if (!existingId) {
      try {
        await db.insert(sites).values({
          id: siteId,
          userId: record.userId,
          ...updatePayload,
        });
      } catch (e: any) {
        const pgCode = e?.cause?.code;
        if (pgCode === '23505') {
          const [conflict] = await db
            .select({ id: sites.id })
            .from(sites)
            .where(and(eq(sites.userId, record.userId), eq(sites.canonicalHost, canonicalHost)))
            .limit(1);

          if (conflict?.id) {
            await db.update(sites).set(updatePayload).where(eq(sites.id, conflict.id));
            const conflictUsedRecord = { ...record, used: true, usedAt: now, siteId: conflict.id };
            await Promise.all([
              redis.set(`pairing:code:${pairCode}`, JSON.stringify(conflictUsedRecord), { ex: PAIRING_TTL_SEC }),
              redis.set(`pairing:id:${record.id}`, JSON.stringify(conflictUsedRecord), { ex: PAIRING_TTL_SEC }),
            ]);
            try {
              await put(
                `sites/${conflict.id}.json`,
                JSON.stringify({
                  siteId: conflict.id,
                  siteUrl: finalSiteUrl,
                  status: 'connected',
                  wpVersion: wpVersion || null,
                  pluginVersion: pluginVersion || null,
                  createdAt: now,
                  updatedAt: now,
                }),
                { access: 'public', contentType: 'application/json' }
              );
            } catch (e) {
              console.error('[handshake] write site blob failed', e);
            }
            await logPairingComplete(conflict.id);
            return jsonNoStore({ siteId: conflict.id, siteToken });
          }
        }
        console.error('[handshake] insert sites failed', e);
        await redis.del(claimKey);
        return jsonNoStore({ error: 'db_insert_failed', code: 'E_DB_INSERT' }, { status: 500 });
      }
    } else {
      try {
        await db.update(sites).set(updatePayload).where(eq(sites.id, siteId));
      } catch (e: any) {
        console.error('[handshake] update sites failed', e);
        await logConnectionError(siteId, 'Database update failed', 'error');
        await redis.del(claimKey);
        return jsonNoStore({ error: 'db_update_failed', code: 'E_DB_UPDATE' }, { status: 500 });
      }
    }

    const usedRecord = { ...record, used: true, usedAt: now, siteId };
    await Promise.all([
      redis.set(`pairing:code:${pairCode}`, JSON.stringify(usedRecord), { ex: PAIRING_TTL_SEC }),
      redis.set(`pairing:id:${record.id}`, JSON.stringify(usedRecord), { ex: PAIRING_TTL_SEC }),
    ]);
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
          updatedAt: now,
        }),
        { access: 'public', contentType: 'application/json' }
      );
    } catch (e) {
      console.error('[handshake] write site blob failed', e);
    }
    await logPairingComplete(siteId);
    return jsonNoStore({ siteId, siteToken });
  } catch (e: any) {
    console.error('[handshake] unhandled error', e);
    if (claimKey) await redis.del(claimKey).catch(() => {});
    return jsonNoStore({ error: 'handshake_failed', code: 'E_UNCAUGHT' }, { status: 500 });
  }
}
