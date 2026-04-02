import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogLevel, StreamProgress, SupportedLocale, TerminalLogEntry } from "../types";
import {
  type AnalysisResultPatch,
  analysisResultPartialSchema,
  analysisResultSchema,
  streamProgressSchema,
  terminalLogEntrySchema,
} from "../contracts/snapshot";

interface StreamState {
  logs: TerminalLogEntry[];
  result: AnalysisResultPatch | null;
  progress: StreamProgress;
  isAnalyzing: boolean;
  error: string | null;
  streamOutcome: "idle" | "success" | "error";
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
    progress: {
      percent: 0,
      stage: "Idle",
      message: "Awaiting new scan",
    },
    isAnalyzing: false,
    error: null,
    streamOutcome: "idle",
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
          progress: {
            percent: 0,
            stage: "Input",
            message: "Please enter a valid URL.",
          },
          isAnalyzing: false,
          error: "Please enter a valid URL.",
          streamOutcome: "error",
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
        progress: {
          percent: 2,
          stage: "Boot",
          message: "Preparing real-time scan pipeline.",
        },
        isAnalyzing: true,
        error: null,
        streamOutcome: "idle",
      });

      if (typeof EventSource === "undefined") {
        setState((prev) => ({
          ...prev,
          progress: {
            percent: 0,
            stage: "Unsupported",
            message: "EventSource is not available in this browser.",
          },
          isAnalyzing: false,
          error: "This browser does not support EventSource.",
          streamOutcome: "error",
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

      source.addEventListener("progress", (event: MessageEvent<string>) => {
        try {
          const rawPayload = JSON.parse(event.data);
          const payload = streamProgressSchema.safeParse(rawPayload);
          if (!payload.success) {
            return;
          }

          setState((prev) => ({
            ...prev,
            progress: payload.data,
          }));
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
            progress: {
              ...prev.progress,
              percent: prev.progress.percent > 0 ? prev.progress.percent : 1,
              stage: "Analyze",
              message: "Received malformed analysis payload.",
            },
            streamOutcome: "error",
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
            progress: {
              ...prev.progress,
              stage: "Error",
              message: payload.message ?? "Streaming failed.",
            },
            isAnalyzing: false,
            streamOutcome: "error",
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            error: "Streaming failed.",
            progress: {
              ...prev.progress,
              stage: "Error",
              message: "Streaming failed.",
            },
            isAnalyzing: false,
            streamOutcome: "error",
          }));
        }
        close();
      });

      source.addEventListener("done", (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { ok?: boolean };
          setState((prev) => ({
            ...prev,
            progress: {
              percent: 100,
              stage: "Done",
              message: payload.ok === false ? "Scan failed." : "Scan complete.",
            },
            streamOutcome:
              prev.streamOutcome === "error"
                ? "error"
                : payload.ok === false
                  ? "error"
                  : "success",
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            progress: {
              ...prev.progress,
              percent: 100,
              stage: "Done",
              message: "Scan complete.",
            },
            streamOutcome: prev.streamOutcome === "error" ? "error" : "success",
          }));
        }
        close();
      });

      source.onerror = () => {
        setState((prev) => ({
          ...prev,
          error: prev.error ?? "Streaming connection interrupted.",
          progress: {
            ...prev.progress,
            stage: "Error",
            message: prev.error ?? "Streaming connection interrupted.",
          },
          streamOutcome: "error",
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
