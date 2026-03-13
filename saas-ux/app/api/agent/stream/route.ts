import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validateHttpUrl(input: string): string | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Direct-streaming proxy:
 * - browser EventSource -> Next.js route -> Python /agent/stream
 * - zero event mapping, zero buffering, zero replay state.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'url query parameter is required' }, { status: 400 });
  }

  const url = validateHttpUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ error: 'url must be a valid http/https URL' }, { status: 400 });
  }

  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return NextResponse.json({ error: 'CREW_SERVICE_BASE_URL must be configured as a full URL' }, { status: 500 });
  }

  const upstream = await fetch(`${baseUrl}/agent/stream?url=${encodeURIComponent(url)}`, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => 'Unable to open upstream stream');
    return NextResponse.json(
      { error: errorText || 'Unable to open upstream stream' },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
