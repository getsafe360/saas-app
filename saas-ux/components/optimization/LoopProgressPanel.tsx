"use client";

// components/optimization/LoopProgressPanel.tsx
// Activity timeline shown while an optimization loop is running

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoopStatusResponse, LoopEvent } from "@/lib/optimization/loops/types";

interface LoopProgressPanelProps {
  loopId: string;
  category: string;
  onClose?: () => void;
  onComplete?: (loop: LoopStatusResponse) => void;
}

const POLL_INTERVAL_MS = 2500;

const TERMINAL_STATUSES = new Set([
  "completed",
  "stopped",
  "failed",
  "rolled_back",
]);

const CATEGORY_LABELS: Record<string, string> = {
  seo: "SEO",
  performance: "Performance",
  security: "Security",
  accessibility: "Accessibility",
  content: "Content",
  wordpress: "WordPress",
};

export function LoopProgressPanel({
  loopId,
  category,
  onClose,
  onComplete,
}: LoopProgressPanelProps) {
  const [loop, setLoop] = useState<LoopStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIterations, setShowIterations] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/optimization-loops/${loopId}`);
      if (!res.ok) {
        setError("Failed to load loop status.");
        return;
      }
      const data: LoopStatusResponse = await res.json();
      setLoop(data);

      if (TERMINAL_STATUSES.has(data.status)) {
        onComplete?.(data);
      }
    } catch {
      setError("Network error — retrying...");
    }
  }, [loopId, onComplete]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (loop && TERMINAL_STATUSES.has(loop.status)) return;
      fetchStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus, loop?.status]);

  const isRunning = loop ? !TERMINAL_STATUSES.has(loop.status) : true;
  const catLabel = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-gray-900/70 backdrop-blur-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
          ) : loop?.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <h3 className="text-sm font-semibold text-white">
            {isRunning ? `Optimizing ${catLabel}…` : `${catLabel} optimization complete`}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Score delta */}
      {loop && loop.startingScore !== null && loop.currentScore !== null && (
        <div className="flex items-center gap-4 rounded-xl bg-slate-800/50 px-4 py-3">
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-0.5">Before</div>
            <div className="text-2xl font-bold text-white">{loop.startingScore}</div>
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              loop.currentScore > loop.startingScore
                ? "bg-green-500/20 text-green-400"
                : loop.currentScore < loop.startingScore
                ? "bg-red-500/20 text-red-400"
                : "bg-slate-700 text-slate-400",
            )}
          >
            {loop.currentScore > loop.startingScore
              ? `+${loop.currentScore - loop.startingScore}`
              : loop.currentScore < loop.startingScore
              ? `${loop.currentScore - loop.startingScore}`
              : "±0"}
          </div>
          <div className="flex-1 h-px bg-slate-700" />
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-0.5">After</div>
            <div
              className={cn(
                "text-2xl font-bold",
                loop.currentScore >= loop.goalScore ? "text-green-400" : "text-white",
              )}
            >
              {loop.currentScore}
            </div>
          </div>
        </div>
      )}

      {/* Events timeline */}
      {loop && loop.events.length > 0 && (
        <div className="space-y-2">
          {loop.events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}
        </div>
      )}

      {/* Loading state */}
      {!loop && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Starting…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Iteration detail toggle */}
      {loop && loop.iterations.length > 0 && (
        <div>
          <button
            onClick={() => setShowIterations((s) => !s)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showIterations ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showIterations ? "Hide" : "Show"} fix details ({loop.iterations.length})
          </button>

          {showIterations && (
            <div className="mt-2 space-y-1.5">
              {loop.iterations.map((it) => (
                <div
                  key={it.id}
                  className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 truncate">{it.issueTitle}</span>
                    <IterationStatusBadge status={it.status} />
                  </div>
                  <div className="mt-1 text-slate-500">
                    Fix type: {it.fixType} · Severity: {it.issueSeverity}
                  </div>
                  {it.errorMessage && (
                    <div className="mt-1 text-red-400">{it.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {loop && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              Iteration {loop.currentIteration} / {loop.maxIterations}
            </span>
            <span>Goal: {loop.goalScore}/100</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (loop.currentIteration / loop.maxIterations) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: LoopEvent & Record<string, unknown> }) {
  const isComplete = event.status === "completed";
  const isFailed = event.status === "failed";
  const isSkipped = event.status === "skipped";

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">
        {isComplete ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
        ) : isFailed ? (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        ) : isSkipped ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-slate-500" />
        )}
      </div>
      <div className="text-xs text-slate-300 leading-relaxed">{event.message}</div>
    </div>
  );
}

function IterationStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    skipped: "bg-amber-500/20 text-amber-400",
    rolled_back: "bg-purple-500/20 text-purple-400",
    applying: "bg-blue-500/20 text-blue-400",
    verifying: "bg-blue-500/20 text-blue-400",
    pending: "bg-slate-700 text-slate-400",
  };

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
        colors[status] ?? "bg-slate-700 text-slate-400",
      )}
    >
      {status}
    </span>
  );
}
