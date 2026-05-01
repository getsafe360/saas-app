"use client";

// SEOFixerPanel — sliding overlay panel that streams AI fix elaborations for
// queued repair actions. Opens when the user clicks "Fix with Sparky".
//
// Stream events consumed: started | fix_item | done | error
// Fix item statuses: processing | done | failed | skipped

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Sparkles, Loader2, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/ai/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FixStatus = "queued" | "processing" | "done" | "failed" | "skipped";

interface FixItem {
  id: string;
  title: string;
  severity?: string;
  section?: string;
  status: FixStatus;
  detail?: string;
  steps?: string[];
  snippet?: string;
  expectedImpact?: string;
  reason?: string;
}

interface FixerDone {
  applied: number;
  skipped: number;
  totalTokensUsed: number;
}

interface SEOFixerPanelProps {
  siteId: string;
  jobId: string;
  /** Pre-seeded list of selected issue IDs & titles for instant rendering */
  queuedItems: Array<{ id: string; title: string; severity?: string; section?: string }>;
  showTokenCost?: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<FixStatus, React.ReactNode> = {
  queued:     <div className="h-4 w-4 rounded-full border border-white/20 flex-shrink-0" />,
  processing: <Loader2 className="h-4 w-4 text-[var(--category-seo)] animate-spin flex-shrink-0" />,
  done:       <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />,
  failed:     <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />,
  skipped:    <SkipForward className="h-4 w-4 text-white/30 flex-shrink-0" />,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-blue-400",
};

function FixCard({ item }: { item: FixItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = item.status === "done" && (item.detail || (item.steps?.length ?? 0) > 0);

  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2 transition-all duration-300",
      item.status === "done"       && "border-green-500/20 bg-green-500/5",
      item.status === "processing" && "border-[var(--category-seo)]/40 bg-[var(--category-seo)]/5",
      item.status === "failed"     && "border-red-400/20 bg-red-400/5",
      item.status === "skipped"    && "border-white/8 bg-white/2 opacity-60",
      item.status === "queued"     && "border-white/8 bg-white/3",
    )}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{STATUS_ICON[item.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white leading-snug">{item.title}</span>
            {item.severity && (
              <span className={cn("text-xs capitalize", SEVERITY_COLOR[item.severity] ?? "text-white/40")}>
                {item.severity}
              </span>
            )}
          </div>
          {item.status === "processing" && (
            <p className="text-xs text-white/40 mt-0.5">{AGENT_NAME} is elaborating the fix…</p>
          )}
          {item.status === "failed" && item.reason && (
            <p className="text-xs text-red-400 mt-0.5">{item.reason}</p>
          )}
          {item.status === "skipped" && (
            <p className="text-xs text-white/35 mt-0.5">Manual fix — see finding details above.</p>
          )}
          {item.status === "done" && item.detail && (
            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{item.detail}</p>
          )}
        </div>
      </div>

      {hasDetail && (
        <div className="pl-6">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-[var(--category-seo)] hover:opacity-80 transition-opacity"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide steps" : "Show steps"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {item.steps && item.steps.length > 0 && (
                <ol className="list-decimal list-inside space-y-1">
                  {item.steps.map((step, i) => (
                    <li key={i} className="text-xs text-white/65 leading-relaxed">{step}</li>
                  ))}
                </ol>
              )}
              {item.snippet && (
                <pre className="rounded-lg bg-black/40 border border-white/8 p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {item.snippet}
                </pre>
              )}
              {item.expectedImpact && (
                <p className="text-xs text-white/40 italic">Impact: {item.expectedImpact}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SEOFixerPanel({
  siteId, jobId, queuedItems, showTokenCost = true, onClose,
}: SEOFixerPanelProps) {
  const [items, setItems] = useState<FixItem[]>(
    queuedItems.map(q => ({ ...q, status: "queued" as FixStatus })),
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<FixerDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<FixItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  const addOrUpdateItem = useCallback((patch: Partial<FixItem> & { id: string }) => {
    setItems(prev => {
      const idx = prev.findIndex(it => it.id === patch.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...patch };
        return updated;
      }
      // New item (e.g. "skipped" manual items that weren't in the initial list)
      return [...prev, { title: patch.id, status: "skipped", ...patch } as FixItem];
    });
  }, []);

  const run = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setRunning(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/sites/${siteId}/seo-fix/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(t) as Record<string, unknown>;
          } catch {
            continue; // skip malformed JSON lines only
          }
          // Handle error events outside the JSON parse try/catch so they
          // propagate to the outer catch and surface to the user.
          if (ev.type === "error") {
            throw new Error(ev.message as string);
          }
          if (ev.type === "fix_item") {
            addOrUpdateItem({
              id: ev.id as string,
              title: ev.title as string,
              severity: ev.severity as string | undefined,
              section: ev.section as string | undefined,
              status: ev.status as FixStatus,
              detail: ev.detail as string | undefined,
              steps: ev.steps as string[] | undefined,
              snippet: ev.snippet as string | undefined,
              expectedImpact: ev.expectedImpact as string | undefined,
              reason: ev.reason as string | undefined,
            });
          } else if (ev.type === "done") {
            setDone({
              applied: ev.applied as number,
              skipped: ev.skipped as number,
              totalTokensUsed: ev.totalTokensUsed as number,
            });
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Fixer failed");
      }
    } finally {
      setRunning(false);
    }
  }, [siteId, jobId, addOrUpdateItem]);

  // Auto-start on mount
  useEffect(() => {
    run();
    return () => { abortRef.current?.abort(); };
  }, [run]);

  const appliedCount = items.filter(it => it.status === "done").length;
  const failedCount  = items.filter(it => it.status === "failed").length;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="relative flex flex-col h-full sm:h-auto sm:max-h-[90vh] w-full sm:w-[520px] rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--background-default)", borderColor: "var(--border-default)", border: "1px solid" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-default)" }}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "oklch(from var(--category-seo) l c h / 0.12)", color: "var(--category-seo)" }}>
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">{AGENT_NAME} SEO Fixer</h2>
            <p className="text-xs text-white/40 truncate">
              {running
                ? `Elaborating ${items.length} fix${items.length === 1 ? "" : "es"}…`
                : done
                ? `${appliedCount} applied · ${done.skipped} manual · ${failedCount} failed`
                : "Ready to apply fixes"}
            </p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 min-h-0">
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-400">Fixer error</p>
                <p className="text-xs text-red-300/70">{error}</p>
              </div>
            </div>
          )}

          {items.map(item => <FixCard key={item.id} item={item} />)}

          {running && (
            <p className="text-xs text-white/30 flex items-center gap-1.5 py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {AGENT_NAME} is working through your queue…
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t space-y-2"
          style={{ borderColor: "var(--border-default)" }}>
          {done && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-white">
                {appliedCount} fix{appliedCount === 1 ? "" : "es"} elaborated
                {done.skipped > 0 && <span className="font-normal text-white/40"> · {done.skipped} manual</span>}
                {failedCount > 0 && <span className="font-normal text-red-400"> · {failedCount} failed</span>}
              </p>
            </div>
          )}
          {showTokenCost && done && done.totalTokensUsed > 0 && (
            <p className="text-xs text-white/30">
              {done.totalTokensUsed.toLocaleString()} tokens used by {AGENT_NAME} for this fix run.
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: done ? "var(--category-seo)" : "var(--border-default)" }}
          >
            {done ? "Close & return to report" : running ? "Working…" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
