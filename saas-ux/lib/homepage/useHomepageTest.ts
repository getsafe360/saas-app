'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CockpitCategory, CockpitEvent, CockpitSavings } from '@/lib/cockpit/sse-events';

type HomepageTestPhase = 'idle' | 'running' | 'completed' | 'error';

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

const LIVE_GREETING = "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.";
const LIVE_SUMMARY = 'Scanning your site and building a live summary…';
const FALLBACK_PENDING_SUMMARY = "We're analyzing your site… If live updates fail, we'll show final results soon.";
const FALLBACK_ERROR_SUMMARY = "We couldn't load live updates or final results. Please try again.";
const TERMINAL_STATES = new Set(['completed', 'errors_found']);

const initialState: HomepageTestState = {
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
  return event.type === 'summary' || (event.type === 'status' && Boolean(event.state && TERMINAL_STATES.has(event.state)));
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
    return { ...initialState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY };
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

export function useHomepageTest() {
  const [state, setState] = useState<HomepageTestState>(initialState);
  const lastMetaRef = useRef<{ revision: number; hash: string }>({ revision: -1, hash: '' });
  const sourceRef = useRef<EventSource | null>(null);

  const closeSource = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const applyEvent = useCallback((event: CockpitEvent, eventTestId: string) => {
    const revision = Number(event.revision ?? -1);
    const hash = String(event.hash ?? '');
    if (revision <= lastMetaRef.current.revision && hash === lastMetaRef.current.hash) {
      return;
    }
    if (revision >= 0) {
      lastMetaRef.current = { revision, hash };
    }

    setState((prev) => reduceHomepageEvent(prev, event, eventTestId));
  }, []);

  const startTest = useCallback(async (url: string) => {
    closeSource();
    setState({ ...initialState, phase: 'running', testedUrl: url, summary: LIVE_SUMMARY });
    lastMetaRef.current = { revision: -1, hash: '' };

    const response = await fetch('/api/test/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, phase: 'error', summary: FALLBACK_ERROR_SUMMARY }));
      return;
    }

    const body = (await response.json()) as { test_id?: string; id?: string };
    const testId = body.test_id ?? body.id ?? null;
    setState((prev) => ({ ...prev, testId, currentTestId: testId }));
    if (!testId) {
      setState((prev) => ({ ...prev, phase: 'error', summary: FALLBACK_ERROR_SUMMARY }));
      return;
    }

    if (typeof EventSource === 'undefined') {
      setTimeout(() => {
        setState((prev) =>
          prev.currentTestId === testId ? { ...prev, phase: 'error', summary: FALLBACK_ERROR_SUMMARY } : prev,
        );
      }, 1200);
      return;
    }

    const source = new EventSource(`/api/test/events/${testId}`);
    sourceRef.current = source;
    let sawTerminalEvent = false;
    let fallbackFetched = false;

    const runResultsFallback = async (fallbackTestId: string) => {
      if (fallbackFetched) {
        return;
      }

      fallbackFetched = true;
      try {
        const fallbackResponse = await fetch(`/api/test/results/${fallbackTestId}`, { cache: 'no-store' });
        if (fallbackResponse.status === 404) {
          setState((prev) =>
            prev.currentTestId === fallbackTestId
              ? { ...initialState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
              : prev,
          );
          return;
        }

        if (!fallbackResponse.ok) {
          throw new Error(`Failed to load fallback results (${fallbackResponse.status})`);
        }

        const fallbackBody = (await fallbackResponse.json()) as {
          summary?: string;
          short_summary?: string;
          greeting?: string;
          categories?: CockpitCategory[];
        };

        setState((prev) => applyFallbackResult(prev, fallbackTestId, fallbackBody));
      } catch {
        setState((prev) =>
          prev.currentTestId === fallbackTestId
            ? { ...initialState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
            : prev,
        );
      }
    };

    const maybeFinishAndClose = (event: CockpitEvent) => {
      if (!isTerminalEvent(event)) {
        return;
      }

      sawTerminalEvent = true;
      window.clearTimeout(delayedFallbackHint);
      closeSource();
    };

    const delayedFallbackHint = window.setTimeout(() => {
      if (sawTerminalEvent) {
        return;
      }
      setState((prev) => (prev.currentTestId === testId && prev.phase === 'running' ? { ...prev, summary: FALLBACK_PENDING_SUMMARY } : prev));
    }, 7000);

    const applyRawEvent = (ev: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(ev.data) as CockpitEvent;
        applyEvent(parsed, testId);
        maybeFinishAndClose(parsed);
      } catch {
        // ignore malformed event payload
      }
    };

    source.addEventListener('status', applyRawEvent as EventListener);
    source.addEventListener('progress', applyRawEvent as EventListener);
    source.addEventListener('summary', applyRawEvent as EventListener);
    source.addEventListener('greeting', applyRawEvent as EventListener);
    source.addEventListener('debug', applyRawEvent as EventListener);
    source.addEventListener('error', applyRawEvent as EventListener);

    source.onopen = () => {
      setState((prev) =>
        prev.currentTestId === testId ? { ...prev, phase: prev.phase === 'idle' ? 'running' : prev.phase } : prev,
      );
    };

    source.onmessage = applyRawEvent as (this: EventSource, ev: MessageEvent) => void;

    source.onerror = () => {
      window.clearTimeout(delayedFallbackHint);
      if (shouldInvokeFallbackOnSseClose(sawTerminalEvent)) {
        void runResultsFallback(testId);
      }
      closeSource();
    };

    sourceRef.current = source;
  }, [applyEvent, closeSource]);

  useEffect(() => () => closeSource(), [closeSource]);

  return useMemo(
    () => ({
      ...state,
      startTest,
    }),
    [state, startTest],
  );
}
