'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CockpitCategory, CockpitEvent, CockpitSavings } from '@/lib/cockpit/sse-events';
import { parseSseEvent } from '@/lib/cockpit/parse-sse-event';

type HomepageTestPhase = 'idle' | 'running' | 'completed' | 'error';

interface HomepageTestState {
  phase: HomepageTestPhase;
  progress: number;
  categories: CockpitCategory[];
  summary?: string;
  savings?: Partial<CockpitSavings>;
  testId: string | null;
  testedUrl: string | null;
}

const initialState: HomepageTestState = {
  phase: 'idle',
  progress: 0,
  categories: [],
  testId: null,
  testedUrl: null,
};

export function useHomepageTest() {
  const [state, setState] = useState<HomepageTestState>(initialState);
  const lastMetaRef = useRef<{ revision: number; hash: string }>({ revision: -1, hash: '' });

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
      if (event.type === 'error' || event.state === 'errors_found') {
        return { ...prev, phase: 'error' };
      }
      if (event.type === 'status') {
        if (event.state === 'completed') {
          const a11y = prev.categories.find((c) => c.id === 'accessibility')?.issues?.length ?? 0;
          const perf = prev.categories.find((c) => c.id === 'performance')?.issues?.length ?? 0;
          return {
            ...prev,
            phase: 'completed',
            progress: 100,
            summary: `We found ${a11y} accessibility issues and ${perf} performance opportunities.`,
          };
        }
        if (event.state === 'in_progress') {
          return { ...prev, phase: 'running' };
        }
      }
      if (event.type === 'progress') {
        return { ...prev, phase: 'running', progress: Number(event.progress ?? prev.progress) };
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
          ...prev,
          phase: 'running',
          categories: [...prev.categories.filter((c) => c.id !== category.id), category],
        };
      }
      if (event.type === 'savings') {
        return { ...prev, savings: event.savings };
      }
      return prev;
    });
  }, []);

  const startTest = useCallback(async (url: string) => {
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

    const body = (await response.json()) as { test_id: string };
    setState((prev) => ({ ...prev, testId: body.test_id }));

    if (typeof EventSource === 'undefined') {
      setTimeout(() => setState((prev) => ({ ...prev, phase: 'completed', progress: 100 })), 1200);
      return;
    }

    const source = new EventSource(`/api/test/events/${body.test_id}`);
    source.onmessage = (raw) => {
      const event = parseSseEvent(raw as MessageEvent<string>);
      if (!event) return;
      applyEvent(event);
      if (event.state === 'completed' || event.state === 'errors_found') {
        source.close();
      }
    };
    source.onerror = async () => {
      source.close();
      try {
        const fallback = await fetch(`/api/test/result/${body.test_id}`, { cache: 'no-store' });
        if (fallback.ok) {
          const result = (await fallback.json()) as { summary: string };
          setState((prev) => ({ ...prev, phase: 'completed', progress: 100, summary: result.summary }));
          return;
        }
      } catch {
        // ignore fallback errors
      }
      setState((prev) => ({ ...prev, phase: 'error' }));
    };
  }, [applyEvent]);

  return useMemo(
    () => ({
      ...state,
      startTest,
    }),
    [state, startTest],
  );
}
