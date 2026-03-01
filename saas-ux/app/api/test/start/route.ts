export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { publishEvent } from '@/lib/cockpit/event-bus';
import type { CockpitEvent } from '@/lib/cockpit/sse-events';
import { setTestResult } from '@/lib/homepage/test-result-store';

function withMeta(event: CockpitEvent, revision: number): CockpitEvent {
  const payload = { ...event, revision, timestamp: new Date().toISOString() };
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
  return { ...payload, hash };
}

function simulateTest(testId: string) {
  let revision = 1;
  const emit = (event: CockpitEvent) => {
    publishEvent(testId, withMeta(event, revision));
    revision += 1;
  };

  emit({ type: 'status', state: 'in_progress' });
  emit({ type: 'progress', state: 'in_progress', progress: 8 });

  const timeline: Array<{ delay: number; event: CockpitEvent }> = [
    {
      delay: 350,
      event: {
        type: 'category',
        state: 'in_progress',
        category: 'accessibility',
        issues: [
          { id: 'a11y-1', severity: 'high', title: 'Buttons missing accessible labels' },
          { id: 'a11y-2', severity: 'medium', title: 'Insufficient contrast in hero section' },
        ],
      },
    },
    { delay: 700, event: { type: 'progress', state: 'in_progress', progress: 52 } },
    {
      delay: 1050,
      event: {
        type: 'category',
        state: 'in_progress',
        category: 'performance',
        issues: [
          { id: 'perf-1', severity: 'medium', title: 'Large hero image without next-gen format' },
          { id: 'perf-2', severity: 'low', title: 'Render-blocking CSS detected' },
          { id: 'perf-3', severity: 'medium', title: 'Unused JavaScript on landing route' },
        ],
      },
    },
    { delay: 1400, event: { type: 'progress', state: 'in_progress', progress: 88 } },
    {
      delay: 1750,
      event: {
        type: 'savings',
        state: 'in_progress',
        savings: { tokens_used: 850, time_saved: '~2h/week', cost_saved: '$120/mo' },
      },
    },
    { delay: 2100, event: { type: 'status', state: 'completed' } },
  ];

  for (const item of timeline) {
    setTimeout(() => emit(item.event), item.delay);
  }

  setTestResult(testId, 'We found 2 accessibility issues and 3 performance opportunities.');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const testId = crypto.randomUUID();
  simulateTest(testId);
  return NextResponse.json({ test_id: testId });
}

