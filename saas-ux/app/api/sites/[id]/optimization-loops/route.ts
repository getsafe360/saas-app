// app/api/sites/[id]/optimization-loops/route.ts
// POST  — start an optimization loop for a site category
// GET   — list loops for a site
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { sites, optimizationLoops } from '@/lib/db/schema';
import { getDbUserFromClerk } from '@/lib/auth/current';
import { getCategoryGoal } from '@/lib/optimization/loops/goals';
import { buildSnapshotForSite, runCategoryLoop } from '@/lib/optimization/loops/runner';
import type { OptimizationMode } from '@/lib/db/schema';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { id: siteId } = await params;
  const db = getDb();

  // Verify site ownership
  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });
  if (site.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Body
  const body = await req.json().catch(() => ({})) as {
    category?: string;
    goalScore?: number;
    maxIterations?: number;
    mode?: OptimizationMode;
  };

  const category = body.category?.toLowerCase() ?? 'seo';
  const goal = getCategoryGoal(category);
  const goalScore = body.goalScore ?? goal.goalScore;
  const maxIterations = body.maxIterations ?? goal.maxIterations;
  const mode: OptimizationMode = body.mode ?? goal.defaultMode;

  // Check for an already-running loop on this site+category
  const [existing] = await db
    .select({ id: optimizationLoops.id, status: optimizationLoops.status })
    .from(optimizationLoops)
    .where(eq(optimizationLoops.siteId, siteId))
    .orderBy(desc(optimizationLoops.createdAt))
    .limit(1);

  const TERMINAL_STATUSES = new Set(['completed', 'stopped', 'failed', 'rolled_back']);
  if (existing && !TERMINAL_STATUSES.has(existing.status)) {
    return NextResponse.json(
      { error: 'A loop is already running for this site.', loopId: existing.id },
      { status: 409 },
    );
  }

  // Require WordPress connection for auto-apply modes
  if (mode !== 'report_only' && (!site.isConnected || !site.tokenHash)) {
    return NextResponse.json(
      { error: 'WordPress connection required to run an optimization loop.', code: 'connector_unavailable' },
      { status: 422 },
    );
  }

  // Build snapshot from latest scan
  const snapshot = await buildSnapshotForSite(siteId, site.siteUrl);
  if (!snapshot) {
    return NextResponse.json(
      { error: 'No scan data found. Run a scan first before optimizing.', code: 'no_scan_data' },
      { status: 422 },
    );
  }

  // Create loop record
  const [loop] = await db
    .insert(optimizationLoops)
    .values({
      siteId,
      category,
      mode,
      status: 'queued',
      goalScore,
      maxIterations,
      currentIteration: 0,
      siteSnapshot: snapshot as any,
    })
    .returning({ id: optimizationLoops.id });

  const loopId = loop.id;

  // Run the loop (fire-and-forget — response returns immediately)
  // The loop updates the DB as it runs; client polls GET /api/optimization-loops/:loopId
  setImmediate(async () => {
    try {
      await runCategoryLoop({
        loopId,
        siteId,
        siteUrl: site.siteUrl,
        siteToken: site.tokenHash!,
        category,
        goalScore,
        maxIterations,
        mode,
        stopOnRegression: true,
        snapshot,
      });
    } catch (err) {
      console.error(`[optimization-loop] Loop ${loopId} crashed:`, err);
      const db2 = getDb();
      await db2
        .update(optimizationLoops)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(optimizationLoops.id, loopId));
    }
  });

  return NextResponse.json({ loopId, status: 'queued' }, { status: 202 });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getDbUserFromClerk();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { id: siteId } = await params;
  const db = getDb();

  const [site] = await db
    .select({ id: sites.id, userId: sites.userId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });
  if (site.userId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const loops = await db
    .select()
    .from(optimizationLoops)
    .where(eq(optimizationLoops.siteId, siteId))
    .orderBy(desc(optimizationLoops.createdAt))
    .limit(20);

  return NextResponse.json({ loops });
}
