// app/api/sites/[id]/backup/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { sites, siteBackups } from '@/lib/db/schema';

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const body = await req.json();
    const { backupId } = body;

    if (!backupId) {
      return NextResponse.json({ success: false, error: 'Backup ID required' }, { status: 400 });
    }

    // Load backup record — must belong to this site and be ready
    const [backup] = await db
      .select()
      .from(siteBackups)
      .where(and(eq(siteBackups.id, backupId), eq(siteBackups.siteId, id)))
      .limit(1);

    if (!backup) {
      return NextResponse.json({ success: false, error: 'Backup not found' }, { status: 404 });
    }

    if (backup.status !== 'ready') {
      return NextResponse.json(
        { success: false, error: `Backup is not ready (status: ${backup.status})` },
        { status: 409 }
      );
    }

    if (backup.expiresAt && backup.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Backup has expired' }, { status: 410 });
    }

    // Mark as restoring
    await db
      .update(siteBackups)
      .set({ status: 'restoring' })
      .where(eq(siteBackups.id, backupId));

    // Fetch checkpoint from blob storage
    const blobResponse = await fetch(backup.blobKey);
    if (!blobResponse.ok) {
      await db.update(siteBackups).set({ status: 'ready' }).where(eq(siteBackups.id, backupId));
      return NextResponse.json({ success: false, error: 'Failed to fetch backup data' }, { status: 502 });
    }

    const checkpoint = await blobResponse.json();
    const snap = checkpoint.site;

    if (!snap || snap.id !== id) {
      await db.update(siteBackups).set({ status: 'ready' }).where(eq(siteBackups.id, backupId));
      return NextResponse.json({ success: false, error: 'Backup data mismatch' }, { status: 422 });
    }

    // Restore tracked site state
    await db
      .update(sites)
      .set({
        status: snap.status,
        cms: snap.cms,
        wpVersion: snap.wpVersion,
        pluginVersion: snap.pluginVersion,
        isConnected: snap.isConnected,
        connectionStatus: snap.connectionStatus,
        wordpressConnection: snap.wordpressConnection,
        aiRepairEnabled: snap.aiRepairEnabled,
        lastScores: snap.lastScores,
        lastSummary: snap.lastSummary,
        lastFindingCount: snap.lastFindingCount,
        lastScreenshotUrl: snap.lastScreenshotUrl,
        lastFaviconUrl: snap.lastFaviconUrl,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, id));

    // Mark backup ready again (can be reused)
    await db
      .update(siteBackups)
      .set({ status: 'ready' })
      .where(eq(siteBackups.id, backupId));

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
      backupId,
      restoredAt: new Date().toISOString(),
      capturedAt: checkpoint.capturedAt,
    });

  } catch (error: any) {
    console.error(`[Backup Restore] Error for site ${id}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
