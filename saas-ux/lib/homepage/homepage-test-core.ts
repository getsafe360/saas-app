import type { CockpitCategory, CockpitEvent, CockpitSavings } from '@/lib/cockpit/sse-events';

export type HomepageTestPhase = 'idle' | 'running' | 'completed' | 'error';

export interface HomepageTestState {
  phase: HomepageTestPhase;
  progress: number;
  categories: CockpitCategory[];
  greeting: string;
  summary?: string;
  savings?: Partial<CockpitSavings>;
  testId: string | null;
  currentTestId: string | null;
  testedUrl: string | null;
  platform: 'wordpress' | 'generic';
  timestamp: string;
}

export const LIVE_GREETING = "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.";
export const LIVE_SUMMARY = 'Scanning your site and building a live summary…';
export const FALLBACK_PENDING_SUMMARY = "We're analyzing your site… If live updates fail, we'll show final results soon.";
export const FALLBACK_ERROR_SUMMARY = "We couldn't load live updates or final results. Please try again.";

const TERMINAL_STATES = new Set(['completed', 'errors_found']);

export const initialHomepageTestState: HomepageTestState = {
  phase: 'idle',
  progress: 0,
  categories: [],
  greeting: LIVE_GREETING,
  summary: undefined,
  testId: null,
  currentTestId: null,
  testedUrl: null,
  platform: 'generic',
  timestamp: new Date(0).toISOString(),
};

function isTerminalEvent(event: CockpitEvent): boolean {
  return (
    event.type === 'status' && Boolean(event.state && TERMINAL_STATES.has(event.state))
  );
}

export function shouldInvokeFallbackOnSseClose(hasTerminalEvent: boolean): boolean {
  return !hasTerminalEvent;
}

export function reduceHomepageEvent(prev: HomepageTestState, event: CockpitEvent, eventTestId: string): HomepageTestState {
  if (prev.currentTestId !== eventTestId) {
    return prev;
  }

  const withMeta = {
    ...prev,
    platform: event.platform ?? prev.platform,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  const withMessage =
    event.message && event.type !== 'summary' && event.type !== 'greeting'
      ? { ...withMeta, summary: event.message, phase: withMeta.phase === 'idle' ? 'running' : withMeta.phase }
      : withMeta;

  if (event.type === 'greeting' && event.message) {
    return { ...withMessage, greeting: event.message, phase: 'running' };
  }

  if (event.type === 'summary') {
    const terminalSummary = event.message ?? withMessage.summary ?? LIVE_SUMMARY;
    return {
      ...withMessage,
      summary: terminalSummary,
      greeting: event.greeting ?? withMessage.greeting,
      phase: 'completed',
      progress: 100,
    };
  }

  if (event.type === 'error') {
    return { ...withMessage, phase: 'error' };
  }

  if (event.type === 'status') {
    if (event.state && TERMINAL_STATES.has(event.state)) {
      return { ...withMessage, phase: 'completed', progress: 100 };
    }
    if (event.state === 'in_progress' || event.state === 'connecting') {
      return { ...withMessage, phase: 'running' };
    }
  }

  if (event.type === 'progress') {
    return {
      ...withMessage,
      phase: 'running',
      progress: Math.max(0, Math.min(100, Number(event.progress ?? withMessage.progress))),
    };
  }

  if (event.type === 'category' && event.category) {
    const category: CockpitCategory = {
      id: event.category,
      issues: event.issues,
      severity: (event.issues?.length ?? 0) > 2 ? 'high' : 'medium',
      tokenCost: (event.issues?.length ?? 0) * 100,
      fixAvailable: true,
    };
    return {
      ...withMessage,
      phase: 'running',
      categories: [...withMessage.categories.filter((c) => c.id !== category.id), category],
    };
  }

  if (event.type === 'savings') {
    return { ...withMessage, savings: event.savings };
  }

  return withMessage;
}

export function applyFallbackResult(prev: HomepageTestState, testId: string, payload: {
  summary?: string;
  short_summary?: string;
  greeting?: string;
  categories?: CockpitCategory[];
}): HomepageTestState {
  if (prev.currentTestId !== testId) {
    return prev;
  }

  const summary = payload.summary ?? payload.short_summary;
  if (!summary) {
    return { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY };
  }

  return {
    ...prev,
    summary,
    greeting: payload.greeting ?? prev.greeting,
    categories: Array.isArray(payload.categories) ? payload.categories : prev.categories,
    phase: 'completed',
    progress: 100,
  };
}

export function isHomepageTerminalEvent(event: CockpitEvent): boolean {
  return isTerminalEvent(event);
}
