// app/api/fix/result/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { fixJobs } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import { users } from '@/lib/db/schema/auth/users';
import { teams, teamMembers } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { kvGet, kvSet } from '@/lib/kv';
import { sendFixCompleteEmail } from '@/lib/email/send';

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 });

  const [job] = await db.select().from(fixJobs).where(eq(fixJobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ ok: false, error: 'fix_job_not_found' }, { status: 404 });

  const key = job.resultBlobKey || `fix-results/${id}.json`;

  const { blobs } = await list({ prefix: key });
  const match = blobs.find(b => b.pathname === key) || blobs[0];
  if (!match) return NextResponse.json({ ok: false, error: 'not_ready' }, { status: 202 });

  const r = await fetch(match.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!j) return NextResponse.json({ ok: false, error: 'read_error' }, { status: 500 });

  // ── Send fix complete email (once per job via KV dedup) ──────────────────
  const emailKey = `email:fix:${id}`;
  const alreadySent = await kvGet(emailKey);
  if (!alreadySent) {
    await kvSet(emailKey, '1', 60 * 60 * 24 * 7); // 7-day TTL

    // Resolve recipient via teamId → team_members → users
    if (job.teamId) {
      const [memberRow] = await db
        .select({ email: users.email, name: users.name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, job.teamId))
        .limit(1);

      const [siteRow] = await db
        .select({ siteUrl: sites.siteUrl })
        .from(sites)
        .where(eq(sites.id, job.siteId))
        .limit(1);

      const [teamRow] = await db
        .select({ tokensRemaining: teams.tokensRemaining })
        .from(teams)
        .where(eq(teams.id, job.teamId))
        .limit(1);

      if (memberRow && siteRow) {
        const result = j?.result ?? j;
        const tokensUsed = result?.tokensUsed ?? job.estTokens ?? 0;
        sendFixCompleteEmail({
          to: memberRow.email,
          firstName: (memberRow.name ?? memberRow.email).split(' ')[0],
          siteUrl: (() => { try { return new URL(siteRow.siteUrl).hostname; } catch { return siteRow.siteUrl; } })(),
          siteId: job.siteId,
          fixTitle:       result?.title ?? 'Fix applied',
          fixCategory:    result?.category ?? 'Optimization',
          fixImpact:      result?.impact ? `+${result.impact} pts` : '',
          fixDescription: result?.description ?? '',
          tokensUsed,
          tokensRemaining: teamRow?.tokensRemaining ?? 0,
        }).catch((e) => console.error('[fix/result] email failed', e));
      }
    }
  }

  return NextResponse.json({ ok: true, result: j });
}
