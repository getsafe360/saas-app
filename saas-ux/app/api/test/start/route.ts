import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url;

  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    return NextResponse.json({ error: 'CREW_SERVICE_BASE_URL is not configured' }, { status: 500 });
  }

  const backendRes = await fetch(`${baseUrl}/api/test/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    cache: 'no-store',
  });

  const json = await backendRes.json();

  const testId = json.test_id || json.id;
  if (!testId) {
    return NextResponse.json({ error: 'Invalid backend start response' }, { status: 500 });
  }

  return NextResponse.json({ id: testId, test_id: testId, status: json.status || 'started' });
}
