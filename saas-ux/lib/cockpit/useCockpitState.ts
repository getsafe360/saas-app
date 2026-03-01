'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { CockpitCategory, CockpitEvent, CockpitSavings, CockpitStateValue } from './sse-events';
import { parseSseEvent } from './parse-sse-event';

interface CockpitStore {
  state: CockpitStateValue;
  progress: number;
  categories: CockpitCategory[];
  savings: CockpitSavings | null;
  repair: { state?: CockpitStateValue; logs: string[] };
}

const initialState: CockpitStore = {
  state: 'idle',
  progress: 0,
  categories: [],
  savings: null,
  repair: { logs: [] },
};

function reducer(store: CockpitStore, event: CockpitEvent): CockpitStore {
  if (event.type === 'status') {
    return { ...store, state: event.state ?? store.state };
  }
  if (event.type === 'progress') {
    return { ...store, progress: event.progress ?? store.progress, state: event.state ?? store.state };
  }
  if (event.type === 'category' && event.category) {
    const category: CockpitCategory = {
      id: event.category,
      issues: event.issues,
      tokenCost: Number(event.issues?.length ?? 0) * 200,
      fixAvailable: true,
      severity: (event.issues?.length ?? 0) > 0 ? 'high' : 'low',
    };
    const next = [...store.categories.filter((item) => item.id !== category.id), category];
    return { ...store, categories: next, state: event.state ?? store.state };
  }
  if (event.type === 'savings') {
    return {
      ...store,
      savings: {
        score_before: Number(event.savings?.score_before ?? 52),
        score_after: Number(event.savings?.score_after ?? 88),
        time_saved: String(event.savings?.time_saved ?? '4h/week'),
        cost_saved: String(event.savings?.cost_saved ?? '$240/mo'),
        tokens_used: Number(event.savings?.tokens_used ?? 0),
      },
    };
  }
  if (event.type === 'repair') {
    return {
      ...store,
      state: event.state ?? store.state,
      repair: {
        state: event.state,
        logs: event.message ? [...store.repair.logs, event.message] : store.repair.logs,
      },
    };
  }
  return store;
}

export function useCockpitState(siteId: string) {
  const [store, dispatch] = useReducer(reducer, initialState);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    const source = new EventSource(`/api/events/${siteId}`);
    let lastRevision = -1;
    let lastHash = '';

    source.onmessage = (message) => {
      const event = parseSseEvent(message as MessageEvent<string>);
      if (!event) {
        console.error('[cockpit] invalid SSE payload');
        return;
      }

      const revision = Number(event.revision ?? -1);
      const hash = String(event.hash ?? '');
      if (revision <= lastRevision && hash && hash === lastHash) return;
      if (revision >= 0) {
        lastRevision = revision;
        lastHash = hash;
      }

      dispatch(event as CockpitEvent);
    };

    source.onerror = () => {
      dispatch({ type: 'status', state: 'disconnected' });
      source.close();
    };

    return () => source.close();
  }, [siteId]);

  const startAnalysis = useCallback(async () => {
    await fetch('/api/scan/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId }),
    });
  }, [siteId]);

  const startRepair = useCallback(
    async (categoryId: string) => {
      await fetch('/api/fix/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, issueIds: [categoryId] }),
      });
    },
    [siteId],
  );

  const categories = useMemo(
    () => (categoryFilter ? store.categories.filter((category) => category.id === categoryFilter) : store.categories),
    [categoryFilter, store.categories],
  );

  return {
    state: store.state,
    progress: store.progress,
    categories,
    savings: store.savings,
    repair: store.repair,
    actions: {
      startAnalysis,
      startRepair,
      openConnectionModal: () => setConnectionModalOpen(true),
      closeConnectionModal: () => setConnectionModalOpen(false),
      setCategoryFilter,
    },
    connectionModalOpen,
  };
}
