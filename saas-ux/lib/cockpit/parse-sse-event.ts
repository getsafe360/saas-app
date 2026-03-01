import type { CockpitEvent } from './sse-events';

export function parseSseEvent(raw: MessageEvent<string>): CockpitEvent | null {
  try {
    const parsed = JSON.parse(raw.data) as CockpitEvent;
    if (!parsed || typeof parsed.type !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
