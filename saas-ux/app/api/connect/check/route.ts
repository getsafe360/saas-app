// app/api/connect/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('pairCode')?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'pairCode required' }, { status: 400 });
  }

  try {
    const raw = await redis.get<string>(`pairing:code:${code}`);

    // Key missing = expired or never existed
    if (!raw) {
      return NextResponse.json({ used: false, expired: true }, { status: 200 });
    }

    // "reserved" is the placeholder written during atomic code reservation
    if (raw === 'reserved') {
      return NextResponse.json({ used: false }, { status: 200 });
    }

    let record: { used?: boolean; siteId?: string; expiresAt?: number } | null = null;
    try {
      record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return NextResponse.json({ used: false }, { status: 200 });
    }

    if (!record) return NextResponse.json({ used: false }, { status: 200 });

    const expired = record.expiresAt ? Date.now() > record.expiresAt : false;

    if (record.used) {
      return NextResponse.json({ used: true, siteId: record.siteId }, { status: 200 });
    }
    return NextResponse.json({ used: false, expired }, { status: 200 });
  } catch {
    return NextResponse.json({ used: false }, { status: 200 });
  }
}
