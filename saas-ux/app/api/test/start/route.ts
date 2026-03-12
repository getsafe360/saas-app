import { NextResponse } from 'next/server';
import type { CockpitEvent } from '@/lib/cockpit/sse-events';
import { publishEvent } from '@/lib/cockpit/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const activeBridges = new Set<string>();

function mapBackendEvent(testId: string, eventName: string, payload: Record<string, unknown>): CockpitEvent | null {
  const normalizedType = String(payload.type ?? eventName ?? '').toLowerCase();

  if (normalizedType === 'log') {
    return { type: 'debug', message: String(payload.message ?? 'backend log') };
  }

  if (normalizedType === 'result') {
    return {
      type: 'summary',
      message: String(payload.summary ?? payload.short_summary ?? 'Analysis complete'),
      greeting: typeof payload.greeting === 'string' ? payload.greeting : undefined,
    };
  }

  if (normalizedType === 'done') {
    return { type: 'status', state: 'completed', message: 'done' };
  }

  if (normalizedType === 'started') {
    return { type: 'status', state: 'in_progress', message: 'started' };
  }

  if (normalizedType === 'progress') {
    return {
      type: 'progress',
      state: 'in_progress',
      progress: Number(payload.progress ?? 0),
      message: typeof payload.message === 'string' ? payload.message : undefined,
    };
  }

  if (normalizedType === 'error') {
    return { type: 'error', message: String(payload.message ?? 'Backend error') };
  }

  if (normalizedType === 'status') {
    const statusValue = String(payload.status ?? payload.message ?? '').toLowerCase();
    if (statusValue === 'done' || statusValue === 'completed') {
      return { type: 'status', state: 'completed', message: 'done' };
    }
    return { type: 'status', state: 'in_progress', message: statusValue || 'started' };
  }

  if (normalizedType === 'debug') {
    return { type: 'debug', message: String(payload.message ?? 'debug event') };
  }

  if (normalizedType === 'greeting') {
    return { type: 'greeting', message: String(payload.greeting ?? payload.message ?? '') };
  }

  if (normalizedType === 'summary') {
    return { type: 'summary', message: String(payload.summary ?? payload.message ?? '') };
  }

  console.debug(`[test-start] dropped unknown backend event testId=${testId} event=${eventName}`);
  return null;
}

async function bridgeBackendEvents(testId: string, baseUrl: string, apiKey?: string) {
  if (activeBridges.has(testId)) {
    return;
  }

  activeBridges.add(testId);
  console.info(`[test-start] bridge start testId=${testId}`);

  try {
    const response = await fetch(`${baseUrl}/api/test/events/${testId}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to connect backend SSE (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = 'message';
    let dataLines: string[] = [];

    const flush = () => {
      if (dataLines.length === 0) return;
      const raw = dataLines.join('\n');
      dataLines = [];

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const mapped = mapBackendEvent(testId, eventName, parsed);
        if (mapped) {
          console.info(`[test-start] publish mapped event testId=${testId} type=${mapped.type}`);
          publishEvent(testId, mapped);
        }
      } catch (error) {
        console.warn(`[test-start] failed to parse backend event testId=${testId}`, error);
      }

      eventName = 'message';
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');

        if (trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.length === 0) {
          flush();
          continue;
        }

        if (trimmed.startsWith('event:')) {
          eventName = trimmed.slice(6).trim() || 'message';
          continue;
        }

        if (trimmed.startsWith('data:')) {
          dataLines.push(trimmed.slice(5).trimStart());
        }
      }
    }

    flush();
    publishEvent(testId, { type: 'status', state: 'completed', message: 'Backend stream ended' });
  } catch (error) {
    console.error(`[test-start] bridge error testId=${testId}`, error);
    publishEvent(testId, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown SSE bridge error',
    });
  } finally {
    activeBridges.delete(testId);
    console.info(`[test-start] bridge stop testId=${testId}`);
  }
}

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

  publishEvent(testId, { type: 'status', state: 'in_progress', message: 'started' });
  void bridgeBackendEvents(testId, baseUrl, apiKey);

  return NextResponse.json({ id: testId, test_id: testId, status: json.status || 'started' });
}
