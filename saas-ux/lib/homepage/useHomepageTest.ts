'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CockpitCategory, CockpitEvent, CockpitSavings } from '@/lib/cockpit/sse-events';

type HomepageTestPhase = 'idle' | 'running' | 'completed' | 'error';

interface HomepageTestState {
  phase: HomepageTestPhase;
  progress: number;
  categories: CockpitCategory[];
  greeting: string;
  summary?: string;
  savings?: Partial<CockpitSavings>;
  testId: string | null;
  testedUrl: string | null;
  platform: 'wordpress' | 'generic';
  timestamp: string;
}

const initialState: HomepageTestState = {
  phase: 'idle',
  progress: 0,
  categories: [],
  greeting: "Hi, I'm Sparky. I'll walk you through what we find in real time.",
  testId: null,
  testedUrl: null,
  platform: 'generic',
  timestamp: new Date(0).toISOString(),
};

export function useHomepageTest() {
  const [state, setState] = useState<HomepageTestState>(initialState);
  const lastMetaRef = useRef<{ revision: number; hash: string }>({ revision: -1, hash: '' });
  const sourceRef = useRef<EventSource | null>(null);

  const closeSource = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const applyEvent = useCallback((event: CockpitEvent) => {
    const revision = Number(event.revision ?? -1);
    const hash = String(event.hash ?? '');
    if (revision <= lastMetaRef.current.revision && hash === lastMetaRef.current.hash) {
      return;
    }
    if (revision >= 0) {
      lastMetaRef.current = { revision, hash };
    }

    setState((prev) => {
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
        return { ...withMessage, greeting: event.message, phase: withMessage.phase === 'idle' ? 'running' : withMessage.phase };
      }

      if (event.type === 'summary' && event.message) {
        return {
          ...withMessage,
          summary: event.message,
          greeting: event.greeting ?? withMessage.greeting,
          phase: 'completed',
          progress: 100,
        };
      }

      if ((event.type as string) === 'categories') {
        const categories = Array.isArray((event as any).categories) ? (event as any).categories : [];
        const mapped = categories
          .filter((cat: any) => cat && typeof cat.id === 'string')
          .map((cat: any): CockpitCategory => ({
            id: cat.id,
            issues: Array.isArray(cat.issues) ? cat.issues : [],
            severity: (Array.isArray(cat.issues) && cat.issues.length > 2) ? 'high' : 'medium',
            tokenCost: (Array.isArray(cat.issues) ? cat.issues.length : 0) * 100,
            fixAvailable: true,
          }));
        return {
          ...withMessage,
          phase: 'running',
          categories: [...withMessage.categories, ...mapped].filter(
            (cat, index, all) => all.findIndex((x) => x.id === cat.id) === index,
          ),
        };
      }

      if ((event.type as string) === 'completed') {
        return {
          ...withMessage,
          phase: 'completed',
          progress: 100,
        };
      }

      if (event.type === 'error' || event.state === 'errors_found') {
        return { ...withMessage, phase: 'error' };
      }
      if (event.type === 'status') {
        if (event.state === 'completed') {
          return {
            ...withMessage,
            phase: 'completed',
            progress: 100,
            summary: withMessage.summary,
          };
        }
        if (event.state === 'in_progress') {
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
    });
  }, []);

  const startTest = useCallback(async (url: string) => {
    closeSource();
    setState({ ...initialState, phase: 'running', testedUrl: url });
    lastMetaRef.current = { revision: -1, hash: '' };

    const response = await fetch('/api/test/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, phase: 'error' }));
      return;
    }

    const body = (await response.json()) as { test_id?: string; id?: string };
    const testId = body.test_id ?? body.id ?? null;
    setState((prev) => ({ ...prev, testId }));
    if (!testId) {
      setState((prev) => ({ ...prev, phase: 'error' }));
      return;
    }

    if (typeof EventSource === 'undefined') {
      setTimeout(() => setState((prev) => ({ ...prev, phase: 'completed', progress: 100 })), 1200);
      return;
    }

    const source = new EventSource(`/api/test/events/${testId}`);
    sourceRef.current = source;
    let sawTerminalEvent = false;
    let fallbackFetched = false;

    const runResultsFallback = async () => {
      if (fallbackFetched) {
        return;
      }

      fallbackFetched = true;
      try {
        const fallbackResponse = await fetch(`/api/test/results/${testId}`, { cache: 'no-store' });
        if (!fallbackResponse.ok) {
          throw new Error(`Failed to load fallback results (${fallbackResponse.status})`);
        }

        const fallbackBody = (await fallbackResponse.json()) as {
          summary?: string;
          short_summary?: string;
          greeting?: string;
          categories?: CockpitCategory[];
          status?: string;
        };

        const summary = fallbackBody.summary ?? fallbackBody.short_summary;
        if (!summary) {
          throw new Error('Fallback result did not include summary');
        }

        setState((prev) => ({
          ...prev,
          summary,
          greeting: fallbackBody.greeting ?? prev.greeting,
          categories: Array.isArray(fallbackBody.categories) ? fallbackBody.categories : prev.categories,
          phase: 'completed',
          progress: 100,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          summary: prev.summary ?? "We're analyzing your site… If live updates fail, we'll show final results soon.",
        }));
      }
    };

    const maybeFinishAndClose = (event: CockpitEvent) => {
      const isTerminal = event.type === 'summary' || (event.type === 'status' && event.state === 'completed');
      if (!isTerminal) {
        return;
      }

      sawTerminalEvent = true;
      closeSource();
    };

    const applyRawEvent = (ev: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(ev.data) as CockpitEvent;
        applyEvent(parsed);
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
    source.addEventListener('error', (ev) => {
      if ('data' in ev && typeof (ev as MessageEvent<string>).data === 'string') {
        applyRawEvent(ev as MessageEvent<string>);
      }
      if (!sawTerminalEvent) {
        void runResultsFallback();
      }
      closeSource();
    });

    source.onopen = () => {
      setState((prev) => ({ ...prev, phase: prev.phase === 'idle' ? 'running' : prev.phase }));
    };

    source.onmessage = applyRawEvent as (this: EventSource, ev: MessageEvent) => void;

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
