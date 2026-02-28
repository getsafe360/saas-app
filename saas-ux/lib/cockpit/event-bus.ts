import type { CockpitEvent } from './sse-events';

const siteSubscribers = new Map<string, Set<ReadableStreamDefaultController<string>>>();

export function subscribeToSiteEvents(siteId: string, controller: ReadableStreamDefaultController<string>) {
  const set = siteSubscribers.get(siteId) ?? new Set<ReadableStreamDefaultController<string>>();
  set.add(controller);
  siteSubscribers.set(siteId, set);
}

export function publishEvent(siteId: string, event: CockpitEvent) {
  const serialized = `data: ${JSON.stringify(event)}\n\n`;
  const set = siteSubscribers.get(siteId);
  if (!set) return;

  for (const controller of set) {
    controller.enqueue(serialized);
  }
}

export function unsubscribe(controller: ReadableStreamDefaultController<string>) {
  for (const [siteId, set] of siteSubscribers.entries()) {
    if (set.has(controller)) {
      set.delete(controller);
      if (set.size === 0) {
        siteSubscribers.delete(siteId);
      }
    }
  }
}
