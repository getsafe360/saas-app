import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Optional compatibility endpoint for clients that still prefer POST before opening SSE.
 * The direct-streaming path can call /api/agent/stream directly and skip this route.
 */
export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!payload?.url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return NextResponse.json({ error: 'CREW_SERVICE_BASE_URL must be configured as a full URL' }, { status: 500 });
  }

  const upstream = await fetch(`${baseUrl}/agent/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
