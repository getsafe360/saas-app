'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CockpitCategory, CockpitEvent } from '@/lib/cockpit/sse-events';
import {
  applyFallbackResult,
  FALLBACK_ERROR_SUMMARY,
  FALLBACK_PENDING_SUMMARY,
  LIVE_SUMMARY,
  initialHomepageTestState,
  isHomepageTerminalEvent,
  reduceHomepageEvent,
  shouldInvokeFallbackOnSseClose,
  type HomepageTestState,
} from './homepage-test-core';

export function useHomepageTest() {
  const [state, setState] = useState<HomepageTestState>(initialHomepageTestState);
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
    setState({ ...initialHomepageTestState, phase: 'running', testedUrl: url, summary: LIVE_SUMMARY });
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
              ? { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
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
            ? { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
            : prev,
        );
      }
    };

    const maybeFinishAndClose = (event: CockpitEvent) => {
      if (!isHomepageTerminalEvent(event)) {
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
