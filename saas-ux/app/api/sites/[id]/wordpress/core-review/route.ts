// app/api/sites/[id]/wordpress/core-review/route.ts
//
// POST: reviews the site's modified and unexpected core files with Claude.
// The connector computes the changed lines on the site; they pass through
// here to Claude and back to the browser and are not stored.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { rateLimit } from '@/lib/api/rate-limit';
import { createWordPressClient } from '@/lib/wordpress/client';
import { parseCoreFileDiff, parseCoreFiles, type WordPressCoreFileDiff } from '@/lib/wordpress/core-files';
import { mergeCoreReview } from '@/lib/wordpress/core-review';
import { coreReviewAvailable, reviewCoreDiffs } from '@/lib/wordpress/core-review-ai';

export const maxDuration = 300;

/** Files sent per review: unexpected files first (most often backdoors), then modified ones. */
const MAX_FILES = 8;
const LOCALES = new Set(['en', 'de', 'es', 'fr', 'it', 'pt']);

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const locale = typeof body?.locale === 'string' && LOCALES.has(body.locale) ? body.locale : 'en';

  const db = getDrizzle();
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, userId)).limit(1);
  const [site] = await db
    .select({
      id: sites.id,
      userId: sites.userId,
      siteUrl: sites.siteUrl,
      tokenHash: sites.tokenHash,
      wordpressConnection: sites.wordpressConnection,
      isConnected: sites.isConnected,
      connectionStatus: sites.connectionStatus,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }
  if (!dbUser || site.userId !== dbUser.id) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
  }
  const tokenHash =
    site.tokenHash || ((site.wordpressConnection as { tokenHash?: string } | null)?.tokenHash ?? null);
  if (!tokenHash || !site.isConnected || site.connectionStatus !== 'connected') {
    return NextResponse.json({ success: false, error: 'WORDPRESS_NOT_CONNECTED' }, { status: 422 });
  }

  const limit = await rateLimit(`core-review:${siteId}`, 6, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'RATE_LIMITED', resetAt: limit.resetAt },
      { status: 429 },
    );
  }

  const client = createWordPressClient({ siteUrl: site.siteUrl, tokenHash, timeout: 30_000 });
  let list;
  try {
    list = parseCoreFiles(await client.coreFiles());
  } catch {
    list = null;
  }
  if (!list) {
    return NextResponse.json({ success: false, error: 'CORE_FILES_UNAVAILABLE' }, { status: 502 });
  }

  const unexpected = new Set(list.unexpected);
  const candidates = [...list.unexpected, ...list.modified];
  const selected = candidates.slice(0, MAX_FILES);
  // A file whose changes cannot be loaded stays in the result as unavailable, never silently dropped.
  const diffs: WordPressCoreFileDiff[] = await Promise.all(
    selected.map(async (path) => {
      let diff: WordPressCoreFileDiff | null = null;
      try {
        diff = parseCoreFileDiff(await client.coreFileDiff(path));
      } catch {
        diff = null;
      }
      return diff && diff.success
        ? diff
        : { success: false, path, kind: unexpected.has(path) ? 'unexpected' : 'modified', diff: null, truncated: false };
    }),
  );
  const unavailable = diffs.filter((diff) => !diff.success).length;

  let aiUsed = false;
  let output = null;
  if (diffs.some((diff) => diff.success) && coreReviewAvailable()) {
    try {
      output = await reviewCoreDiffs({ version: list.version, locale, diffs });
      aiUsed = true;
    } catch (error) {
      console.warn('[core-review] AI review failed:', error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json(
    {
      success: true,
      version: list.version,
      complete: list.complete,
      aiUsed,
      omitted: candidates.length - selected.length,
      unavailable,
      files: mergeCoreReview(diffs, output),
      reviewedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
