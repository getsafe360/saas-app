import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, LogLevel, SupportedLocale, TerminalLogEntry } from "../types";
import {
  type AnalysisResultPatch,
  analysisResultPartialSchema,
  analysisResultSchema,
  terminalLogEntrySchema,
} from "../contracts/snapshot";

interface StreamState {
  logs: TerminalLogEntry[];
  result: AnalysisResultPatch | null;
  isAnalyzing: boolean;
  error: string | null;
}

function mergeAnalysisResult(
  previous: AnalysisResultPatch | null,
  incoming: AnalysisResultPatch,
): AnalysisResultPatch {
  return {
    ...(previous ?? {}),
    ...incoming,
    accessibility: {
      ...(previous?.accessibility ?? {}),
      ...(incoming.accessibility ?? {}),
    },
    performance: {
      ...(previous?.performance ?? {}),
      ...(incoming.performance ?? {}),
    },
    seo: {
      ...(previous?.seo ?? {}),
      ...(incoming.seo ?? {}),
    },
    security: {
      ...(previous?.security ?? {}),
      ...(incoming.security ?? {}),
    },
    content: {
      ...(previous?.content ?? {}),
      ...(incoming.content ?? {}),
    },
    wordpress:
      previous?.wordpress || incoming.wordpress
        ? {
            ...(previous?.wordpress ?? {}),
            ...(incoming.wordpress ?? {}),
            vulnerabilities:
              incoming.wordpress?.vulnerabilities ?? previous?.wordpress?.vulnerabilities,
          }
        : undefined,
    usage:
      previous?.usage || incoming.usage
        ? {
            ...(previous?.usage ?? {}),
            ...(incoming.usage ?? {}),
          }
        : undefined,
  };
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function useSparkySnapshotStream(locale: SupportedLocale) {
  const [state, setState] = useState<StreamState>({
    logs: [],
    result: null,
    isAnalyzing: false,
    error: null,
  });

  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setState((prev) => ({ ...prev, isAnalyzing: false }));
  }, []);

  const appendLog = useCallback((params: {
    level: LogLevel;
    stage: string;
    message: string;
    metric?: string;
    timestamp?: string;
  }) => {
    setState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          level: params.level,
          stage: params.stage,
          message: params.message,
          metric: params.metric,
          timestamp: params.timestamp ?? nowTime(),
        },
      ],
    }));
  }, []);

  const start = useCallback(
    (inputUrl: string) => {
      const url = normalizeUrl(inputUrl);
      if (!url) {
        close();
        setState({
          logs: [],
          result: null,
          isAnalyzing: false,
          error: "Please enter a valid URL.",
        });
        return;
      }

      close();
      setState({
        logs: [
          {
            timestamp: nowTime(),
            level: "INFO",
            stage: "Boot",
            message: `Initiating scan for: ${url}`,
          },
        ],
        result: null,
        isAnalyzing: true,
        error: null,
      });

      if (typeof EventSource === "undefined") {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: "This browser does not support EventSource.",
        }));
        return;
      }

      const source = new EventSource(
        `/api/sparky/stream?url=${encodeURIComponent(url)}&locale=${encodeURIComponent(locale)}`,
      );
      sourceRef.current = source;

      source.addEventListener("log", (event: MessageEvent<string>) => {
        try {
          const rawPayload = JSON.parse(event.data);
          const payload = terminalLogEntrySchema.partial().safeParse(rawPayload);
          if (!payload.success || !payload.data.message) {
            return;
          }

          appendLog({
            level: (payload.data.level ?? "INFO") as LogLevel,
            stage: payload.data.stage ?? "Stream",
            message: payload.data.message,
            metric: payload.data.metric,
            timestamp: payload.data.timestamp,
          });
        } catch {
          // Ignore malformed event payloads.
        }
      });

      source.addEventListener("result", (event: MessageEvent<string>) => {
        try {
          const rawPayload = JSON.parse(event.data);
          const payload = analysisResultSchema.safeParse(rawPayload);
          if (!payload.success) {
            throw new Error("Invalid result payload.");
          }
          setState((prev) => ({ ...prev, result: payload.data }));
        } catch {
          setState((prev) => ({
            ...prev,
            error: "Received malformed analysis payload.",
          }));
        }
      });

      source.addEventListener("partial", (event: MessageEvent<string>) => {
        try {
          const rawPayload = JSON.parse(event.data);
          const parsed = analysisResultPartialSchema.safeParse(rawPayload);
          if (!parsed.success) {
            return;
          }

          const payload = parsed.data;
          setState((prev) => ({
            ...prev,
            result: mergeAnalysisResult(prev.result, payload),
          }));
        } catch {
          // Ignore malformed event payloads.
        }
      });

      source.addEventListener("error", (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { message?: string };
          setState((prev) => ({
            ...prev,
            error: payload.message ?? "Streaming failed.",
            isAnalyzing: false,
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            error: "Streaming failed.",
            isAnalyzing: false,
          }));
        }
        close();
      });

      source.addEventListener("done", () => {
        close();
      });

      source.onerror = () => {
        setState((prev) => ({
          ...prev,
          error: prev.error ?? "Streaming connection interrupted.",
        }));
        close();
      };
    },
    [appendLog, close, locale],
  );

  useEffect(() => () => close(), [close]);

  return useMemo(
    () => ({ ...state, start, close }),
    [close, start, state],
  );
}
