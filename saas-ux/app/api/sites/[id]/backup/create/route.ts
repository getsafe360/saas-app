// app/api/sites/[id]/backup/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
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
    .where(eq(schema.users.clerkUserId, cu.id))
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

    const body = await request.json();
    const includes: string[] = body.includes ?? ['database', 'files', 'plugins', 'themes'];

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
        status: site.status,
        cms: site.cms,
        wpVersion: site.wpVersion,
        pluginVersion: site.pluginVersion,
        isConnected: site.isConnected,
        connectionStatus: site.connectionStatus,
        wordpressConnection: site.wordpressConnection,
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
      addRandomSuffix: false,
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
      downloadUrl: blob.url,
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
