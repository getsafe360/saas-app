import { NextResponse } from 'next/server';
import { getTestResult } from '@/lib/homepage/test-result-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const result = getTestResult(testId);
  if (!result) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(result);
}
