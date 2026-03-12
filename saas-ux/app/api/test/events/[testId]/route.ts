import { NextRequest } from 'next/server';
import { publishEvent, subscribeToSiteEvents, unsubscribe } from '@/lib/cockpit/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;

  let controllerRef: ReadableStreamDefaultController<string> | null = null;

  const stream = new ReadableStream<string>({
    start(controller) {
      controllerRef = controller;
      console.info(`[test-events] subscribe testId=${testId}`);

      subscribeToSiteEvents(testId, controller);
      publishEvent(testId, { type: 'status', state: 'connecting', message: 'SSE connected' });
    },

    cancel() {
      if (controllerRef) {
        console.info(`[test-events] cancel testId=${testId}`);
        unsubscribe(controllerRef);
      }
    },
  });

  req.signal.addEventListener('abort', () => {
    if (controllerRef) {
      console.info(`[test-events] abort testId=${testId}`);
      unsubscribe(controllerRef);
    }
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
