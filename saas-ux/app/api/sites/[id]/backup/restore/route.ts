// app/api/sites/[id]/backup/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
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
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const userId = await getAppUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { backupId } = body;

    if (!backupId) {
      return NextResponse.json({ success: false, error: 'Backup ID required' }, { status: 400 });
    }

    // Verify ownership before loading the backup
    const [siteOwnership] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.userId, userId)))
      .limit(1);

    if (!siteOwnership) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
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
      .where(and(eq(sites.id, id), eq(sites.userId, userId)));

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
