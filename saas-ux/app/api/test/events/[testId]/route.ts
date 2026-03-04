import { NextRequest } from 'next/server';
import { subscribeToSiteEvents, unsubscribe } from '@/lib/cockpit/event-bus';

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

      // Subscribe this controller to the event bus
      subscribeToSiteEvents(testId, controller);

      // Correct initial event (no global "event"!)
      controller.enqueue(
        `data: ${JSON.stringify({ type: 'status', state: 'connecting' })}\n\n`
      );
    },

    cancel() {
      if (controllerRef) unsubscribe(controllerRef);
    },
  });

  // Abort handler for client disconnect
  req.signal.addEventListener('abort', () => {
    if (controllerRef) unsubscribe(controllerRef);
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
