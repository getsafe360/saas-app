import type { CockpitEvent } from './sse-events';

const siteSubscribers = new Map<string, Set<ReadableStreamDefaultController<string>>>();

function toSsePayload(event: CockpitEvent) {
  const eventName = typeof event.type === 'string' ? event.type : 'message';
  return `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function subscribeToSiteEvents(siteId: string, controller: ReadableStreamDefaultController<string>) {
  const set = siteSubscribers.get(siteId) ?? new Set<ReadableStreamDefaultController<string>>();
  set.add(controller);
  siteSubscribers.set(siteId, set);

  console.info(`[event-bus] subscribe site=${siteId} subscribers=${set.size}`);
}

export function publishEvent(siteId: string, event: CockpitEvent) {
  const set = siteSubscribers.get(siteId);
  console.info(`[event-bus] publish site=${siteId} type=${event.type} subscribers=${set?.size ?? 0}`);
  if (!set || set.size === 0) return;

  const serialized = toSsePayload(event);

  for (const controller of set) {
    try {
      controller.enqueue(serialized);
      console.debug(`[event-bus] enqueue site=${siteId} type=${event.type}`);
    } catch (error) {
      console.warn(`[event-bus] enqueue failed site=${siteId} type=${event.type}`, error);
      set.delete(controller);
    }
  }

  if (set.size === 0) {
    siteSubscribers.delete(siteId);
  }
}

export function unsubscribe(controller: ReadableStreamDefaultController<string>) {
  for (const [siteId, set] of siteSubscribers.entries()) {
    if (!set.has(controller)) continue;

    set.delete(controller);
    console.info(`[event-bus] unsubscribe site=${siteId} subscribers=${set.size}`);

    if (set.size === 0) {
      siteSubscribers.delete(siteId);
    }

    return;
  }
}
