// app/api/connect/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('pairCode')?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'pairCode required' }, { status: 400 });
  }

  try {
    const { blobs } = await list({ prefix: `pairings/code-${code}.json`, limit: 1 });
    if (!blobs.length) {
      // Treat as invalid/expired code
      return NextResponse.json({ used: false, expired: true }, { status: 200 });
    }

    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ used: false }, { status: 200 });

    const record = await res.json().catch(() => null) as
      | { used?: boolean; siteId?: string; expiresAt?: number }
      | null;

    if (!record) return NextResponse.json({ used: false }, { status: 200 });

    const expired = record.expiresAt ? Date.now() > record.expiresAt : false;

    if (record.used) {
      return NextResponse.json({ used: true, siteId: record.siteId }, { status: 200 });
    }
    return NextResponse.json({ used: false, expired }, { status: 200 });
  } catch {
    // Don’t leak details
    return NextResponse.json({ used: false }, { status: 200 });
  }
}
