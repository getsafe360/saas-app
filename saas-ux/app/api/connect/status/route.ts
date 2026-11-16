// app/api/connect/status/route.ts
//
// POST { siteId } with X-Site-Key: sha256(site token), from the WordPress plugin.
// Tells the plugin whether the platform still knows this site and token, so a
// plugin left with an old pairing (site removed, or paired with another
// environment) stops showing "Connected". Without the matching key the answer
// is always { known: false }: it reveals nothing about which sites exist.

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { clientIp, rateLimit, tooManyRequests } from '@/lib/api/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`connect-status:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit);

  const body = (await req.json().catch(() => null)) as { siteId?: unknown } | null;
  const siteId = typeof body?.siteId === 'string' ? body.siteId.trim() : '';
  const key = req.headers.get('x-site-key')?.trim() ?? '';
  if (!UUID.test(siteId) || !SHA256.test(key)) return NextResponse.json({ known: false });

  const [site] = await getDrizzle()
    .select({ id: sites.id, status: sites.status })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.tokenHash, key.toLowerCase())))
    .limit(1);
  return NextResponse.json({ known: Boolean(site), ...(site ? { status: site.status } : {}) });
}
