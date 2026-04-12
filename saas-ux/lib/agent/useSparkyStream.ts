"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SparkyLogLevel = "INFO" | "SUCCESS" | "WARNING" | "METRIC" | "ERROR";

export type SparkyMessage = {
  id: string;
  text: string;
  role: "system" | "sparky";
  level?: SparkyLogLevel;
  stage?: string;
};

export type SparkySnapshot = {
  url: string;
  locale: string;
  generatedAt: string;
  text: string;
  platform: "wordpress" | "generic";
  greeting?: string;
  /** Server-provided count of high-impact issues. When present, used directly
   *  in the UI instead of any client-side inference. */
  highImpactCount?: number;
  /** AI-generated WordPress security & maintenance section. Only present when
   *  WordPress markers are detected in the scanned page. */
  wordpressSection?: string;
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

  const appendMessage = useCallback((message: Omit<SparkyMessage, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: crypto.randomUUID() }]);
  }, []);

  const start = useCallback(() => {
    if (!url) return;

    close();
    setMessages([{ id: crypto.randomUUID(), role: "system", text: "Initializing analysis engine…", level: "INFO", stage: "Boot" }]);
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
      try {
        const payload = JSON.parse(event.data) as {
          text?: string;
          level?: SparkyLogLevel;
          stage?: string;
        };

        if (!payload.text) return;

        appendMessage({
          role: "sparky",
          text: payload.text,
          level: payload.level ?? "INFO",
          stage: payload.stage ?? "Stream",
        });
      } catch {
        // Ignore malformed payloads.
      }
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
  }, [appendMessage, close, locale, url]);

  useEffect(() => () => close(), [close]);

  return useMemo(
    () => ({ messages, isStreaming, error, snapshot, start, close }),
    [close, error, isStreaming, messages, snapshot, start],
  );
}
