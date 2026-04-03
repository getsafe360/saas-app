import { NextResponse } from 'next/server';
import { getTestServiceConfig, isValidHttpBaseUrl } from '@/lib/homepage/test-service-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const input = (await req.json().catch(() => null)) as
    | { url?: string; language?: string; platform?: string; name?: string }
    | null;

  if (!input?.url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const { baseUrl, apiKey, sourceVar } = getTestServiceConfig();

  if (!baseUrl) {
    console.error('[test/start] backend base URL not configured');
    return NextResponse.json(
      { error: 'No test backend URL configured. Set HOMEPAGE_TEST_SERVICE_BASE_URL, TEST_SERVICE_BASE_URL, or CREW_SERVICE_BASE_URL.' },
      { status: 500 },
    );
  }

  if (!isValidHttpBaseUrl(baseUrl)) {
    console.error('[test/start] invalid backend base URL:', { sourceVar, baseUrl });
    return NextResponse.json(
      { error: `${sourceVar ?? 'Configured URL'} must be a full URL including protocol` },
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
