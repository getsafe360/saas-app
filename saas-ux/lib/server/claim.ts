// lib/server/claim.ts
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { guestSessions, guestScans, scanJobs, scheduledScans, idempotency } from '@/lib/db/schema';
import { sites } from '@/lib/db/schema/sites';
import crypto from 'crypto';

const sha256hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function claimGuestSession({
  userId,
  claimToken,
  idempotencyKey,                     // random uuid from client to prevent dupe
  defaultFrequency = 'monthly' as 'daily'|'weekly'|'monthly',
}: {
  userId: number;
  claimToken: string;
  idempotencyKey: string;
  defaultFrequency?: 'daily'|'weekly'|'monthly';
}) {
  const db = getDb();

  // Idempotency guard
  try {
    await db.insert(idempotency).values({ key: idempotencyKey, scope: 'claim-guest-session' });
  } catch (e: any) {
    if (e?.code === '23505') {
      return { ok: true, alreadyClaimed: true as const }; // same request replayed
    }
    throw e;
  }

  // 1) load claimable session + scans
  const [sess] = await db
    .select()
    .from(guestSessions)
    .where(and(eq(guestSessions.claimToken, claimToken), eq(guestSessions.isClaimed, false)))
    .limit(1);

  if (!sess) return { ok: false, reason: 'not-found-or-claimed' as const };

  // Expiry check (you can also do this in SQL)
  if (sess.expiresAt && new Date(sess.expiresAt) < new Date()) {
    return { ok: false, reason: 'expired' as const };
  }

  const scans = await db
    .select()
    .from(guestScans)
    .where(eq(guestScans.guestSessionId, sess.id));

  if (scans.length === 0) {
    // Mark claimed to avoid replays with empty data
    await db.update(guestSessions).set({ isClaimed: true, claimedAt: sql`now()`, claimedByUserId: userId })
      .where(eq(guestSessions.id, sess.id));
    return { ok: true, imported: 0 };
  }

  // We’ll import the freshest scan (or all; choose UX). Here: latest one
  const latest = scans.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

    // 2) Upsert site by (user_id, canonical_host)
    const [siteRow] = await db
    .insert(sites)
    .values({
        userId,
        siteUrl: latest.siteUrl,
        // Provide required NOT NULL columns via SQL funcs:
        canonicalHost: sql`canonical_host_from_url(${latest.siteUrl})`,
        canonicalRoot: sql`canonical_root_from_url(${latest.siteUrl})`,
        status: 'pending',             // no plugin token yet
        updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
        target: [sites.userId, sites.canonicalHost],
        set: {
        // keep URL fresh & recompute canonicals on change
        siteUrl: latest.siteUrl,
        canonicalHost: sql`canonical_host_from_url(${latest.siteUrl})`,
        canonicalRoot: sql`canonical_root_from_url(${latest.siteUrl})`,
        cms: 'wordpress',
        status: 'connected',
        updatedAt: sql`now()`,
        },
    })
    .returning();

  // 3) Create scan job & copy guest blob to a durable key
  //    If your Blob provider doesn’t support server-side copy, fetch and re-upload.
  const jobId = crypto.randomUUID();
  const finalBlobKey = `reports/${siteRow.id}/${jobId}.json`;

  // Pseudo: await copyBlob(latest.reportBlobKey, finalBlobKey);
  // If copy fails, you can still link to guest blob and mark for GC later.

  const [job] = await db.insert(scanJobs).values({
    id: jobId,
    siteId: siteRow.id,
    status: 'done',                   // since guest report is already complete
    categories: latest.categories,
    reportBlobKey: finalBlobKey,
    updatedAt: sql`now()`,
    endedAt: sql`now()`,
  }).returning();

  // 4) Mark session claimed
  await db.update(guestSessions).set({
    isClaimed: true, claimedAt: sql`now()`, claimedByUserId: userId,
  }).where(eq(guestSessions.id, sess.id));

  // 5) Ensure a scheduled scan row exists (monthly by default)
  await db
    .insert(scheduledScans)
    .values({
      siteId: siteRow.id,
      frequency: defaultFrequency,
      nextRunAt: sql`now() + interval '30 days'`,
    })
    .onConflictDoUpdate({
      target: [scheduledScans.siteId],
      set: {
        frequency: defaultFrequency,
        // don’t shorten next_run_at if it’s already sooner; keep the earlier date
        nextRunAt: sql`LEAST(${scheduledScans.nextRunAt.name}, now() + interval '30 days')`,
        updatedAt: sql`now()`,
      },
    });

  return { ok: true, imported: 1, siteId: siteRow.id, jobId: job.id };
}
