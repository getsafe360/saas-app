// app/api/sites/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema/sites';
import { users } from '@/lib/db/schema/auth/users';
import { eq, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { currentUser } from '@clerk/nextjs/server';
import { del } from '@vercel/blob';

const DEV = process.env.NODE_ENV !== 'production';

// Get the app user ID (same logic as add endpoint)
async function getAppUserId(db: ReturnType<typeof getDb>): Promise<number | null> {
  // 1) Local session user
  try {
    const u = await getUser();
    if (u?.id) return u.id;
  } catch {
    // ignore
  }

  // 2) Clerk user
  const cu = await currentUser().catch(() => null);
  if (!cu) return null;

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, cu.id))
    .limit(1);

  return row?.id ?? null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const requestId = crypto.randomUUID();
  const { id: siteId } = await params;

  if (!siteId) {
    return NextResponse.json(
      { ok: false, error: 'SITE_ID_REQUIRED' },
      { status: 400, headers: { 'X-Request-Id': requestId } }
    );
  }

  // Verify user is authenticated
  const userId = await getAppUserId(db);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'SIGN_IN_REQUIRED' },
      { status: 401, headers: { 'X-Request-Id': requestId } }
    );
  }

  try {
    // Verify the site belongs to this user before deleting
    const [existingSite] = await db
      .select({ id: sites.id, userId: sites.userId })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!existingSite) {
      return NextResponse.json(
        { ok: false, error: 'SITE_NOT_FOUND' },
        { status: 404, headers: { 'X-Request-Id': requestId } }
      );
    }

    if (existingSite.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED' },
        { status: 403, headers: { 'X-Request-Id': requestId } }
      );
    }

    // Delete the site from database
    await db.delete(sites).where(eq(sites.id, siteId));

    // Try to delete the blob record (non-fatal if it fails)
    try {
      await del(`sites/${siteId}.json`);
    } catch (e) {
      if (DEV) console.warn('[sites/delete] Blob delete failed (non-fatal)', e);
    }

    return NextResponse.json(
      { ok: true, siteId },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    if (DEV) console.error('[sites/delete] DB delete failed', e);
    return NextResponse.json(
      { ok: false, error: 'DB_DELETE_FAILED', message: String(e?.message ?? e) },
      { status: 500, headers: { 'X-Request-Id': requestId } }
    );
  }
}
