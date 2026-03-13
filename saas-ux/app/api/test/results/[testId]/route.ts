import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;
  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl) {
    return NextResponse.json({ error: 'CREW_SERVICE_BASE_URL is not configured' }, { status: 500 });
  }

  const backendRes = await fetch(`${baseUrl}/api/test/results/${testId}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: 'no-store',
  });

  const body = await backendRes.json().catch(() => ({ error: 'Invalid backend response' }));
  return NextResponse.json(body, { status: backendRes.status });
}
