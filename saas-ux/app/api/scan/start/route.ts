// app/api/scan/start/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { list } from '@vercel/blob';
import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema/sites'; 
import { scanJobs } from '@/lib/db/schema'; 
import { getDbUserFromClerk } from '@/lib/auth/current';

// Narrow body type
type Category = 'seo' | 'performance' | 'accessibility' | 'security';
type Body = { siteId?: string; categories?: Category[] };

// Small helper for safer error payloads
function dbErr(e: unknown) {
  const any = e as any;
  return {
    message: any?.message ?? 'db error',
    code: any?.code,
    detail: any?.detail,
  };
}

// Try to load site metadata from Blob and insert a DB row with userId
async function ensureSiteExistsForUser(db: ReturnType<typeof getDb>, siteId: string, userId: number) {
  // 1) Already there?
  const existing = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (existing[0]) return existing[0];

  // 2) Hydrate from Blob: sites/{id}.json written during handshake
  try {
    const { blobs } = await list({ prefix: `sites/${siteId}.json`, limit: 1 });
    const b = blobs[0];
    if (!b) return null;

    const r = await fetch(b.url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!j || !j.siteUrl) return null;

    // Insert with userId set (avoid NOT NULL violation)
    await db.insert(sites).values({
      id: siteId,
      userId,
      siteUrl: j.siteUrl,
      status: (j.status ?? 'connected') as any,
      cms: (j.cms ?? 'wordpress') as any,
      wpVersion: j.wpVersion ?? null,
      pluginVersion: j.pluginVersion ?? null,
      createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
      updatedAt: j.updatedAt ? new Date(j.updatedAt) : new Date(),
    });

    const [inserted] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    return inserted ?? null;
  } catch (e) {
    console.error('[scan/start] ensureSiteExistsForUser blob->db failed', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();

  // 1) Auth (server-side Clerk)
  const user = await getDbUserFromClerk();
  if (!user) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 });
  }

  // 2) Body
  const body = (await req.json().catch(() => null)) as Body | null;
  const siteId = body?.siteId?.trim();
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  }
  const cats: Category[] =
    body?.categories?.length ? body.categories : ['seo', 'performance', 'accessibility', 'security'];

  // 3) Make sure the site row exists and is owned by this user
  let site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site[0]) {
    // Try to hydrate from Blob (created by handshake)
    const inserted = await ensureSiteExistsForUser(db, siteId, user.id);
    if (!inserted) {
      return NextResponse.json(
        { error: 'site not found; connect it first', hint: 'Run WP plugin handshake or add the site in Dashboard.' },
        { status: 404 },
      );
    }
    site = [inserted];
  } else {
    // Optional: verify ownership (for multi-user safety)
    if (site[0].userId !== user.id) {
      return NextResponse.json({ error: 'forbidden: site belongs to another user' }, { status: 403 });
    }
  }

  // 4) Enqueue scan job (with FK satisfied)
  const jobId = crypto.randomUUID();
  try {
    await db.insert(scanJobs).values({
      id: jobId,
      siteId,
      status: 'queued',
      categories: cats.join(','), // store as CSV
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (e) {
    console.error('[scan/start] enqueue error', e);
    return NextResponse.json({ error: 'failed to enqueue', detail: dbErr(e) }, { status: 500 });
  }

  return NextResponse.json({ jobId, queued: true });
}
