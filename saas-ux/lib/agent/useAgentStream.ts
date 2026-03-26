'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type AgentStreamPhase = 'idle' | 'streaming' | 'completed' | 'error';

export interface AgentStreamState {
  phase: AgentStreamPhase;
  messages: string[];
  summary: string | null;
  greeting: string;
  error: string | null;
  progress: number;
  activeUrl: string | null;
}

const DEFAULT_GREETING = "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.";

function normalizeUrl(input: string): string | null {
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    phase: 'idle',
    messages: [],
    summary: null,
    greeting: DEFAULT_GREETING,
    error: null,
    progress: 0,
    activeUrl: null,
  });

  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = useCallback(
    (inputUrl: string) => {
      const nextUrl = normalizeUrl(inputUrl);
      if (!nextUrl) {
        setState((prev) => ({ ...prev, phase: 'error', error: 'Please enter a valid http/https URL.' }));
        return;
      }

      close();
      setState({
        phase: 'streaming',
        messages: [],
        summary: null,
        greeting: DEFAULT_GREETING,
        error: null,
        progress: 5,
        activeUrl: nextUrl,
      });

      if (typeof EventSource === 'undefined') {
        setState((prev) => ({ ...prev, phase: 'error', error: 'This browser does not support live streaming.' }));
        return;
      }

      const source = new EventSource(`/api/agent/stream?url=${encodeURIComponent(nextUrl)}`);
      sourceRef.current = source;

      source.addEventListener('message', (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { text?: unknown };
          const text = typeof payload.text === 'string' ? payload.text : '';
          if (!text) {
            return;
          }

          setState((prev) => {
            const messages = [...prev.messages, text];
            const progress = Math.min(95, Math.max(10, messages.length * 20));
            return { ...prev, messages, progress, phase: 'streaming' };
          });
        } catch {
          // Ignore malformed SSE payloads.
        }
      });

      source.addEventListener('summary', (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { summary?: string; greeting?: string };
          setState((prev) => ({
            ...prev,
            phase: 'completed',
            summary: payload.summary ?? prev.summary,
            greeting: payload.greeting ?? prev.greeting,
            progress: 100,
          }));
        } finally {
          close();
        }
      });

      source.onerror = () => {
        setState((prev) => ({
          ...prev,
          phase: prev.phase === 'completed' ? 'completed' : 'error',
          error: prev.phase === 'completed' ? null : 'Live stream disconnected before completion.',
        }));
        close();
      };
    },
    [close],
  );

  useEffect(() => () => close(), [close]);

  return useMemo(() => ({ ...state, start, close }), [close, start, state]);
}
