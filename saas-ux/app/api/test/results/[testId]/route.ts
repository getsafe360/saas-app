import { NextResponse } from 'next/server';
import { getTestServiceConfig } from '@/lib/homepage/test-service-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;
  const { baseUrl, apiKey } = getTestServiceConfig();

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'No test backend URL configured. Set HOMEPAGE_TEST_SERVICE_BASE_URL, TEST_SERVICE_BASE_URL, or CREW_SERVICE_BASE_URL.' },
      { status: 500 },
    );
  }

  const backendRes = await fetch(`${baseUrl}/api/test/results/${testId}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: 'no-store',
  });

  const body = await backendRes.json().catch(() => ({ error: 'Invalid backend response' }));
  return NextResponse.json(body, { status: backendRes.status });
}
