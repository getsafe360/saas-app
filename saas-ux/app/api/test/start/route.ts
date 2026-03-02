export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { publishEvent } from '@/lib/cockpit/event-bus';
import type { CockpitEvent } from '@/lib/cockpit/sse-events';
import { setTestResult } from '@/lib/homepage/test-result-store';

type SparkyCategory = {
  id: string;
  issues: Array<Record<string, unknown>>;
};

type SparkyResult = {
  greeting: string;
  summary: string;
  categories: SparkyCategory[];
  platform: 'wordpress' | 'generic';
};

function withMeta(event: CockpitEvent, revision: number): CockpitEvent {
  const payload = { ...event, revision, timestamp: new Date().toISOString() };
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
  return { ...payload, hash };
}

function looksLikeWordPress(url: string): boolean {
  const lowered = url.toLowerCase();
  return lowered.includes('wp-') || lowered.includes('wordpress') || lowered.includes('/blog');
}

function detectPlatform(url: string): 'wordpress' | 'generic' {
  if (looksLikeWordPress(url)) return 'wordpress';
  return 'generic';
}

function normalizeCategories(raw: unknown): SparkyCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const parsed = item as { id?: unknown; issues?: unknown };
      const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
      if (!id) return null;
      const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((issue) => typeof issue === 'object' && issue !== null) : [];
      return { id, issues: issues as Array<Record<string, unknown>> };
    })
    .filter((category): category is SparkyCategory => category !== null);
}

function parseSparkyResponse(raw: unknown, fallbackPlatform: 'wordpress' | 'generic'): SparkyResult {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const platform = data.platform === 'wordpress' || data.platform === 'generic' ? data.platform : fallbackPlatform;
  const greeting = typeof data.greeting === 'string' ? data.greeting.trim() : '';
  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  return {
    greeting,
    summary,
    categories: normalizeCategories(data.categories),
    platform,
  };
}

async function runSparkyHomepageTest(input: {
  url: string;
  language: string;
  platform: 'wordpress' | 'generic';
  name?: string;
}): Promise<SparkyResult> {
  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl) {
    throw new Error('CREW_SERVICE_BASE_URL is not configured');
  }

  const response = await fetch(`${baseUrl}/api/test/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      run_module: 'sparky',
      module: 'sparky',
      task_key: 'site_snapshot_task',
      url: input.url,
      language: input.language,
      platform: input.platform,
      name: input.name,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Sparky request failed (${response.status})`);
  }

  const data = (await response.json()) as { result?: unknown } | unknown;
  const payload = data && typeof data === 'object' && 'result' in (data as Record<string, unknown>)
    ? (data as { result?: unknown }).result
    : data;

  return parseSparkyResponse(payload, input.platform);
}

async function publishSparkyEvents(testId: string, sparky: SparkyResult) {
  let revision = 1;
  const emit = (event: CockpitEvent) => {
    publishEvent(testId, withMeta(event, revision));
    revision += 1;
  };

  emit({ type: 'status', state: 'in_progress' });

  for (const c of sparky.categories) {
    emit({
      type: 'category',
      category: c.id,
      issues: c.issues,
      platform: sparky.platform,
    });
  }

  if (sparky.greeting) {
    emit({
      type: 'greeting',
      message: sparky.greeting,
      platform: sparky.platform,
    });
  }

  emit({
    type: 'summary',
    message: sparky.summary,
    greeting: sparky.greeting,
    platform: sparky.platform,
  });

  emit({
    type: 'status',
    state: 'completed',
    platform: sparky.platform,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { url?: string; language?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }

  const authState = await auth();
  const user = authState?.userId ? await currentUser() : null;
  const userName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
    : undefined;

  const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'en';
  const detectedPlatform = detectPlatform(body.url);

  const testId = crypto.randomUUID();

  try {
    const sparky = await runSparkyHomepageTest({
      url: body.url,
      language,
      platform: detectedPlatform,
      name: userName,
    });

    const finalSummary = sparky.summary || sparky.greeting || 'Homepage test completed.';
    setTestResult(testId, finalSummary);

    await publishSparkyEvents(testId, {
      ...sparky,
      platform: sparky.platform || detectedPlatform,
      summary: finalSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Homepage test failed';
    publishEvent(testId, withMeta({ type: 'error', state: 'errors_found', message }, 1));
    publishEvent(testId, withMeta({ type: 'status', state: 'errors_found', message }, 2));
  }

  return NextResponse.json({ test_id: testId });
}
