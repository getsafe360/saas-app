"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SparkyMessage = {
  id: string;
  text: string;
  role: "system" | "sparky";
};

export type SparkySnapshot = {
  url: string;
  locale: string;
  generatedAt: string;
  text: string;
  sections: {
    seoGeo: string;
    accessibility: string;
    performance: string;
    security: string;
    content: string;
    ctaLine: string;
  };
};

export function useSparkyStream(url: string, locale: string) {
  const [messages, setMessages] = useState<SparkyMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<SparkySnapshot | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setIsStreaming(false);
  }, []);

  const appendChunk = useCallback((chunk: string) => {
    const segments = chunk.replace(/\r/g, "").split("\n").filter(Boolean);
    if (segments.length === 0) return;

    setMessages((prev) => {
      const next = [...prev];
      for (const part of segments) {
        const last = next[next.length - 1];
        if (last?.role === "sparky") {
          last.text = `${last.text}${part}`;
        } else {
          next.push({ id: crypto.randomUUID(), text: part, role: "sparky" });
        }
      }
      return next;
    });
  }, []);

  const start = useCallback(() => {
    if (!url) return;

    close();
    setMessages([{ id: crypto.randomUUID(), role: "system", text: "Connecting to Sparky stream..." }]);
    setError(undefined);
    setSnapshot(null);
    setIsStreaming(true);

    if (typeof EventSource === "undefined") {
      setError("This browser does not support EventSource.");
      setIsStreaming(false);
      return;
    }

    const source = new EventSource(
      `/api/agent/stream?url=${encodeURIComponent(url)}&locale=${encodeURIComponent(locale)}`,
    );
    sourceRef.current = source;

    source.addEventListener("message", (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { text?: string };
      if (payload.text) appendChunk(payload.text);
    });

    source.addEventListener("snapshot", (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as SparkySnapshot;
      setSnapshot(payload);
    });

    source.addEventListener("error", (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { message?: string };
        setError(payload.message ?? "Streaming failed.");
      } catch {
        setError("Streaming failed.");
      }
    });

    source.addEventListener("done", () => {
      close();
    });

    source.onerror = () => {
      close();
    };
  }, [appendChunk, close, locale, url]);

  useEffect(() => () => close(), [close]);

  return useMemo(
    () => ({ messages, isStreaming, error, snapshot, start, close }),
    [close, error, isStreaming, messages, snapshot, start],
  );
}
