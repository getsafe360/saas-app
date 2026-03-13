import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input = (await req.json().catch(() => null)) as
    | { url?: string; language?: string; platform?: string; name?: string }
    | null;

  if (!input?.url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl) {
    console.error('CREW_SERVICE_BASE_URL missing or invalid:', process.env.CREW_SERVICE_BASE_URL);
    return NextResponse.json({ error: 'CREW_SERVICE_BASE_URL is not configured' }, { status: 500 });
  }

  if (!/^https?:\/\//.test(baseUrl)) {
    console.error('CREW_SERVICE_BASE_URL missing or invalid:', process.env.CREW_SERVICE_BASE_URL);
    return NextResponse.json(
      { error: 'CREW_SERVICE_BASE_URL must be a full URL including protocol' },
      { status: 500 },
    );
  }

  const backendRes = await fetch(`${baseUrl}/api/test/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ url: input.url }),
    cache: 'no-store',
  });

  const json = (await backendRes.json()) as { test_id?: string; id?: string; status?: string };
  const testId = json.test_id || json.id;

  if (!testId) {
    return NextResponse.json({ error: 'Invalid backend start response' }, { status: 500 });
  }

  return NextResponse.json({ id: testId, test_id: testId, status: json.status || 'started' });
}
