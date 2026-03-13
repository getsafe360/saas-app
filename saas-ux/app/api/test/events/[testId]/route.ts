import { NextRequest } from 'next/server';
import type { CockpitEvent } from '@/lib/cockpit/sse-events';
import { mapBackendEvent } from '@/lib/cockpit/sse-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toSse(event: CockpitEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;

  const baseUrl = process.env.CREW_SERVICE_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.CREW_SERVICE_API_KEY;

  if (!baseUrl) {
    return new Response('event: error\ndata: {"type":"error","message":"CREW_SERVICE_BASE_URL is not configured"}\n\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  if (!/^https?:\/\//.test(baseUrl)) {
    return new Response('event: error\ndata: {"type":"error","message":"CREW_SERVICE_BASE_URL must be a full URL including protocol"}\n\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      // This route is a direct backend SSE bridge, because in-memory buses do not
      // work reliably across serverless instances where start/events handlers can run separately.
      const bridgeAbort = new AbortController();
      const onRequestAbort = () => bridgeAbort.abort();
      req.signal.addEventListener('abort', onRequestAbort, { once: true });

      const send = (event: CockpitEvent) => {
        controller.enqueue(toSse(event));
      };

      try {
        send({ type: 'status', state: 'connecting', message: 'SSE connected' });

        const response = await fetch(`${baseUrl}/api/test/events/${testId}`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          cache: 'no-store',
          signal: bridgeAbort.signal,
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
          if (dataLines.length === 0) {
            return;
          }

          const raw = dataLines.join('\n');
          dataLines = [];

          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const mapped = mapBackendEvent(testId, eventName, parsed);
            if (mapped) {
              send(mapped);
            }
          } catch (error) {
            console.warn(`[test-events] failed to parse backend event testId=${testId}`, error);
          }

          eventName = 'message';
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

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
        send({ type: 'debug', message: 'Backend stream ended' });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.name === 'AbortError'
              ? 'SSE client disconnected'
              : error.message
            : 'Unknown SSE bridge error';

        send({ type: 'error', message });
      } finally {
        req.signal.removeEventListener('abort', onRequestAbort);
        controller.close();
      }
    },

    cancel() {
      console.info(`[test-events] cancel testId=${testId}`);
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
