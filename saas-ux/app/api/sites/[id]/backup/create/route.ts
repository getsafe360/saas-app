// app/api/sites/[id]/backup/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, isNull } from 'drizzle-orm';
import { put } from '@vercel/blob';
import * as schema from '@/lib/db/schema';
import { sites, siteBackups } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { currentUser } from '@clerk/nextjs/server';

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

async function getAppUserId(): Promise<number | null> {
  try {
    const u = await getUser();
    if (u?.id) return u.id;
  } catch {
    // ignore
  }
  const cu = await currentUser().catch(() => null);
  if (!cu) return null;
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.clerkUserId, cu.id), isNull(schema.users.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const userId = await getAppUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    // A restore point captures GetSafe 360's own record of the site (scores,
    // summary). It does not copy WordPress files or the database, so it must
    // not claim to. WordPress changes are undone per action (wordpress/rollback).
    void body;
    const includes: string[] = ['scan-state'];

    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.userId, userId)))
      .limit(1);

    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    // Insert row immediately so we have the UUID
    const [record] = await db
      .insert(siteBackups)
      .values({
        siteId: id,
        method: 'checkpoint',
        status: 'creating',
        blobKey: 'pending',
        includes,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    // Checkpoint payload — everything we track about the site in our DB
    const checkpoint = {
      backupId: record.id,
      capturedAt: new Date().toISOString(),
      site: {
        id: site.id,
        siteUrl: site.siteUrl,
        canonicalHost: site.canonicalHost,
        canonicalRoot: site.canonicalRoot,
        // Never include connection state or credentials (wordpressConnection
        // holds the connector key): blobs are public, and restoring an old
        // token would undo a reconnect or revive a revoked connection.
        aiRepairEnabled: site.aiRepairEnabled,
        lastScores: site.lastScores,
        lastSummary: site.lastSummary,
        lastFindingCount: site.lastFindingCount,
        lastScreenshotUrl: site.lastScreenshotUrl,
        lastFaviconUrl: site.lastFaviconUrl,
      },
    };

    const payload = JSON.stringify(checkpoint);
    const blobKey = `backups/${id}/${record.id}.json`;

    const blob = await put(blobKey, payload, {
      access: 'public',
      contentType: 'application/json',
      // Unguessable URL; the SDK version in use has no private blobs.
      addRandomSuffix: true,
      allowOverwrite: false,
    });

    // Mark ready and store blob URL
    await db
      .update(siteBackups)
      .set({
        status: 'ready',
        blobKey: blob.url,
        sizeBytes: Buffer.byteLength(payload, 'utf8'),
      })
      .where(eq(siteBackups.id, record.id));

    return NextResponse.json({
      success: true,
      backupId: record.id,
      timestamp: record.createdAt.toISOString(),
      method: 'checkpoint',
      size: Buffer.byteLength(payload, 'utf8'),
      includes,
      expiresAt: record.expiresAt?.toISOString(),
    });

  } catch (error: any) {
    console.error(`[Backup Create] Error for site ${id}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
