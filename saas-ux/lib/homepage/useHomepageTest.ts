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
  const stalledStreamCheckRef = useRef<number | null>(null);
  const delayedFallbackHintRef = useRef<number | null>(null);

  const FALLBACK_MAX_ATTEMPTS = 12;
  const FALLBACK_BASE_DELAY_MS = 1000;
  const STALLED_STREAM_TIMEOUT_MS = 10000;
  const STALLED_CHECK_INTERVAL_MS = 2000;

  const closeSource = useCallback(() => {
    if (delayedFallbackHintRef.current !== null) {
      window.clearTimeout(delayedFallbackHintRef.current);
      delayedFallbackHintRef.current = null;
    }
    if (stalledStreamCheckRef.current !== null) {
      window.clearInterval(stalledStreamCheckRef.current);
      stalledStreamCheckRef.current = null;
    }
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
    let lastEventAt = Date.now();

    const runResultsFallback = async (fallbackTestId: string) => {
      if (fallbackFetched) {
        return;
      }

      fallbackFetched = true;
      for (let attempt = 1; attempt <= FALLBACK_MAX_ATTEMPTS; attempt += 1) {
        try {
          const fallbackResponse = await fetch(`/api/test/results/${fallbackTestId}`, { cache: 'no-store' });

          if (fallbackResponse.status === 404) {
            const fallback404Body = (await fallbackResponse.json().catch(() => null)) as {
              status?: string;
              error?: string;
            } | null;
            const fallbackStatus = fallback404Body?.status;

            if (fallbackStatus === 'failed' || fallbackStatus === 'error') {
              setState((prev) =>
                prev.currentTestId === fallbackTestId
                  ? {
                    ...initialHomepageTestState,
                    phase: 'error',
                    summary: fallback404Body?.error || FALLBACK_ERROR_SUMMARY,
                  }
                  : prev,
              );
              return;
            }

            if (attempt < FALLBACK_MAX_ATTEMPTS) {
              setState((prev) =>
                prev.currentTestId === fallbackTestId
                  ? { ...prev, phase: 'running', summary: FALLBACK_PENDING_SUMMARY }
                  : prev,
              );
              await new Promise((resolve) => window.setTimeout(resolve, attempt * FALLBACK_BASE_DELAY_MS));
              continue;
            }

            setState((prev) =>
              prev.currentTestId === fallbackTestId
                ? { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
                : prev,
            );
            return;
          }

          if (!fallbackResponse.ok) {
            setState((prev) =>
              prev.currentTestId === fallbackTestId
                ? { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
                : prev,
            );
            return;
          }

          const fallbackBody = (await fallbackResponse.json()) as {
            summary?: string;
            short_summary?: string;
            greeting?: string;
            categories?: CockpitCategory[];
          };

          setState((prev) => applyFallbackResult(prev, fallbackTestId, fallbackBody));
          return;
        } catch {
          if (attempt < FALLBACK_MAX_ATTEMPTS) {
            setState((prev) =>
              prev.currentTestId === fallbackTestId
                ? { ...prev, phase: 'running', summary: FALLBACK_PENDING_SUMMARY }
                : prev,
            );
            await new Promise((resolve) => window.setTimeout(resolve, attempt * FALLBACK_BASE_DELAY_MS));
            continue;
          }

          setState((prev) =>
            prev.currentTestId === fallbackTestId
              ? { ...initialHomepageTestState, phase: 'idle', summary: FALLBACK_ERROR_SUMMARY }
              : prev,
          );
          return;
        }
      }
    };

    const closeWithCleanup = () => closeSource();

    const maybeFinishAndClose = (event: CockpitEvent) => {
      if (!isHomepageTerminalEvent(event)) {
        return;
      }

      sawTerminalEvent = true;
      closeWithCleanup();
      void runResultsFallback(testId);
    };

    delayedFallbackHintRef.current = window.setTimeout(() => {
      if (sawTerminalEvent) {
        return;
      }
      setState((prev) => (prev.currentTestId === testId && prev.phase === 'running' ? { ...prev, summary: FALLBACK_PENDING_SUMMARY } : prev));
    }, 7000);

    const applyRawEvent = (ev: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(ev.data) as CockpitEvent;
        lastEventAt = Date.now();
        applyEvent(parsed, testId);
        maybeFinishAndClose(parsed);
      } catch {
        // ignore malformed event payload
      }
    };

    source.addEventListener('status', applyRawEvent as EventListener);
    source.addEventListener('progress', applyRawEvent as EventListener);
    source.addEventListener('category', applyRawEvent as EventListener);
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
      if (shouldInvokeFallbackOnSseClose(sawTerminalEvent)) {
        void runResultsFallback(testId);
      }
      closeWithCleanup();
    };

    stalledStreamCheckRef.current = window.setInterval(() => {
      if (sawTerminalEvent || fallbackFetched) {
        if (stalledStreamCheckRef.current !== null) {
          window.clearInterval(stalledStreamCheckRef.current);
          stalledStreamCheckRef.current = null;
        }
        return;
      }

      if (Date.now() - lastEventAt >= STALLED_STREAM_TIMEOUT_MS) {
        void runResultsFallback(testId);
      }
    }, STALLED_CHECK_INTERVAL_MS);

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
