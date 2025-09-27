// app/api/fix/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs, scanJobs, sites, teams } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { list } from '@vercel/blob';
import crypto from 'crypto';

// Reuse the helper we created earlier to get current team (or inline it here)
import { findCurrentUserTeam } from '@/lib/auth/current';

type StartBody = { siteId: string; issueIds: string[] };

async function readLatestReportForSite(siteId: string) {
  const db = getDb();

  // latest DONE job for this site
  const [job] = await db
    .select()
    .from(scanJobs)
    .where(and(eq(scanJobs.siteId, siteId), eq(scanJobs.status, 'done')))
    .orderBy(desc(scanJobs.updatedAt))
    .limit(1);

  if (!job) return null;

  // prefer explicit blob key, else conventional key
  const key = job.reportBlobKey || `scan-results/${job.id}.json`;

  const { blobs } = await list({ prefix: key });
  const match = blobs.find(b => b.pathname === key) || blobs[0];
  if (!match) return null;

  const r = await fetch(match.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  return j?.report ?? null;
}

export async function POST(req: NextRequest) {
  const db = getDb();

  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { siteId, issueIds } = body || {};
  if (!siteId || !Array.isArray(issueIds) || issueIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'siteId_and_issueIds_required' }, { status: 400 });
  }

  // Verify site exists
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return NextResponse.json({ ok: false, error: 'site_not_found' }, { status: 404 });

  // Current team (or user)
  const current = await findCurrentUserTeam();
  if (!current?.team?.id) {
    return NextResponse.json({ ok: false, error: 'no_team' }, { status: 403 });
  }
  const teamId = current.team.id;

  // Pull latest report to tailor fixes + token estimate
  const report = await readLatestReportForSite(siteId);
  if (!report) {
    return NextResponse.json({ ok: false, error: 'no_recent_scan' }, { status: 409 });
  }

  // Map requested ids to estTokens (fallback to 500 if not present)
  const estMap = new Map<string, number>();
  for (const it of report.issues || []) estMap.set(it.id, it.estTokens || 500);
  const selected = issueIds.map(id => ({ id, estTokens: estMap.get(id) ?? 500 }));

  const estTokens = selected.reduce((sum, x) => sum + x.estTokens, 0);

  // Load team tokens
  const [teamRow] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const have = teamRow?.tokensRemaining ?? 0;

  if (have < estTokens) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_tokens', have, need: estTokens },
      { status: 422 }
    );
  }

  // Create fix job
  const fixJobId = crypto.randomUUID();
  await db.insert(fixJobs).values({
    id: fixJobId,
    teamId,
    siteId,
    status: 'queued',
    issues: selected as any,
    estTokens,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Deduct tokens immediately (simple). Optional: move to "holds".
  await db.update(teams)
    .set({ tokensRemaining: (have - estTokens) as any })
    .where(eq(teams.id, teamId));

  return NextResponse.json({ ok: true, fixJobId, estTokens });
}
