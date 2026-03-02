import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);
  if (!data?.url || !data?.testId) {
    return NextResponse.json({ error: 'Missing required test payload fields' }, { status: 400 });
  }

  const payload = {
    ...data,
    ts: Date.now(),
    v: 1,
  };

  const key = `stashes/${crypto.randomUUID()}.json`;
  const result = await put(key, JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
  });

  return NextResponse.json({ ok: true, stashKey: key, stashUrl: result.url, url: result.url });
}
