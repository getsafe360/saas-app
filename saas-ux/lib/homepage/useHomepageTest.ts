'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CockpitCategory, CockpitEvent, CockpitSavings } from '@/lib/cockpit/sse-events';
import { parseSseEvent } from '@/lib/cockpit/parse-sse-event';

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
          phase: withMessage.phase === 'idle' ? 'running' : withMessage.phase,
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
        return { ...withMessage, phase: 'running', progress: Number(event.progress ?? withMessage.progress) };
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
        const fallback = await fetch(`/api/test/result/${testId}`, { cache: 'no-store' });
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
