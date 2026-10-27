// app/api/sites/add/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema/sites';
import { users } from '@/lib/db/schema/auth/users';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { auth, currentUser } from '@clerk/nextjs/server';
import { hashPassword } from '@/lib/auth/session';
import { ensureAppUserId } from '@/lib/auth/ensure-app-user';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { put } from '@vercel/blob';

const DEV = process.env.NODE_ENV !== 'production';

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const url = new URL(u);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const requestId = crypto.randomUUID();

  // Parse & validate URL
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
  }

  const rawUrl = String(payload?.url ?? '').trim();
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: 'URL_REQUIRED' }, { status: 400 });
  }

  let siteUrl: string;
  try {
    siteUrl = normalizeUrl(rawUrl);
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_URL' }, { status: 400 });
  }

  // The server later fetches this URL (connection tests, scans, WordPress calls),
  // so a site must point at a public address, never an internal one.
  if (!(await isPublicUrlResolved(siteUrl))) {
    return NextResponse.json({ ok: false, error: 'INVALID_URL' }, { status: 400 });
  }

  // Resolve / provision app user id
  const userId = await ensureAppUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'SIGN_IN_REQUIRED' },
      { status: 401, headers: { 'X-Request-Id': requestId } }
    );
  }

  // Create site
  const siteId = crypto.randomUUID();

  // Extract canonical host and root from URL for unique constraint
  let canonicalHost: string;
  let canonicalRoot: string;
  try {
    const urlObj = new URL(siteUrl);
    canonicalHost = urlObj.hostname;
    canonicalRoot = `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    canonicalHost = siteUrl;
    canonicalRoot = siteUrl;
  }

  try {
    await db.insert(sites).values({
      id: siteId,
      siteUrl,
      canonicalHost,
      canonicalRoot,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId
    } as any);
  } catch (e: any) {
    if (DEV) console.error('[sites/add] DB insert failed', e);
    return NextResponse.json(
      { ok: false, error: 'DB_INSERT_FAILED', message: String(e?.message ?? e) },
      { status: 500, headers: { 'X-Request-Id': requestId } }
    );
  }

  // Also write a Blob record so detail pages load instantly
  try {
    const record = {
      siteId,
      siteUrl,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await put(`sites/${siteId}.json`, JSON.stringify(record, null, 2), {
      access: 'public',
      contentType: 'application/json'
    });
  } catch (e) {
    if (DEV) console.warn('[sites/add] Blob write failed (non-fatal)', e);
  }

  return NextResponse.json(
    { ok: true, siteId, siteUrl, userId },
    { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
  );
}
