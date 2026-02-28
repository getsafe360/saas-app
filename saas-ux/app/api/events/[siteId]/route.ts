import { NextRequest } from 'next/server';
import { publishEvent, subscribeToSiteEvents, unsubscribe } from '@/lib/cockpit/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  let streamController: ReadableStreamDefaultController<string> | null = null;

  const stream = new ReadableStream<string>({
    start(controller) {
      streamController = controller;
      subscribeToSiteEvents(siteId, controller);
      publishEvent(siteId, { type: 'status', state: 'connecting' });
    },
    cancel() {
      if (streamController) {
        unsubscribe(streamController);
      }
    },
  });

  req.signal.addEventListener('abort', () => {
    publishEvent(siteId, { type: 'status', state: 'disconnected' });
    if (streamController) {
      unsubscribe(streamController);
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
