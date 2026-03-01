import { NextResponse } from 'next/server';
import { getTestResult } from '@/app/api/test/start/route';

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
