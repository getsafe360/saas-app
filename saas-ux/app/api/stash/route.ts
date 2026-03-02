import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

const REQUIRED_FIELDS = ['url', 'testId', 'categories', 'summary', 'platform', 'timestamp'] as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonWithCors(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function isValidPayload(data: any): data is {
  url: string;
  testId: string;
  categories: unknown[];
  summary: string;
  platform: string;
  timestamp: string;
} {
  if (!data || typeof data !== 'object') return false;

  if (typeof data.url !== 'string' || data.url.trim().length === 0) return false;
  if (typeof data.testId !== 'string' || data.testId.trim().length === 0) return false;
  if (!Array.isArray(data.categories)) return false;
  if (typeof data.summary !== 'string' || data.summary.trim().length === 0) return false;
  if (typeof data.platform !== 'string' || data.platform.trim().length === 0) return false;
  if (typeof data.timestamp !== 'string' || data.timestamp.trim().length === 0) return false;

  return true;
}

function sanitizeTestId(testId: string) {
  return testId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);

  if (!isValidPayload(data)) {
    return jsonWithCors(
      { error: `Missing or invalid required fields: ${REQUIRED_FIELDS.join(', ')}` },
      { status: 400 }
    );
  }

  const key = `test-stash/${sanitizeTestId(data.testId)}.json`;
  const result = await put(key, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return jsonWithCors({ stashUrl: result.url });
}
