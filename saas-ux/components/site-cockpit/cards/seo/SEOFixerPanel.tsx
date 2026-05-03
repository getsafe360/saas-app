"use client";

// SEOFixerPanel — full-page 3-step repair flow.
//
// Step 1 · Pre-flight   — summary, connection status, token estimate, start/cancel
// Step 2 · Running      — live NDJSON stream, per-fix status cards, progress bar
// Step 3 · Results      — summary stats, stub diff/patch actions, restore section
//
// Stream events consumed: started | fix_item | done | error

import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft, Sparkles, Loader2, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, SkipForward,
  Shield, Wifi, WifiOff, FileCode2, FileText, Settings2,
  RotateCcw, Download, GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/ai/constants";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "preflight" | "running" | "results";
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

export interface QueuedItem {
  id: string;
  title: string;
  severity?: string;
  section?: string;
  fixType?: string;
  effort?: string;
}

export interface SEOFixerPanelProps {
  siteId: string;
  jobId: string;
  queuedItems: QueuedItem[];
  tokensRemaining: number;
  showTokenCost?: boolean;
  connectionStatus?: ConnectionStatus;
  cmsType?: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Token cost heuristic (pre-flight estimate)
// ---------------------------------------------------------------------------

const EFFORT_TOKENS: Record<string, number> = { low: 80, medium: 150, high: 250 };

function estimateTokenCost(items: QueuedItem[]): number {
  return items
    .filter((i) => i.fixType !== "manual")
    .reduce((sum, i) => sum + (EFFORT_TOKENS[i.effort ?? "medium"] ?? 150), 0);
}

// ---------------------------------------------------------------------------
// Status icons / severity colours
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

// ---------------------------------------------------------------------------
// FixCard
// ---------------------------------------------------------------------------

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
            onClick={() => setExpanded((v) => !v)}
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
// ConnectionBadge — compact inline status for pre-flight
// ---------------------------------------------------------------------------

function ConnectionBadge({
  connectionStatus,
  cmsType,
  siteId,
}: {
  connectionStatus?: ConnectionStatus;
  cmsType?: string;
  siteId: string;
}) {
  const isConnected = connectionStatus === "connected";
  const platform = cmsType
    ? cmsType.charAt(0).toUpperCase() + cmsType.slice(1)
    : "your site";

  return (
    <div className="rounded-xl border p-4 flex items-start gap-3"
      style={{
        borderColor: isConnected ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)",
        background:  isConnected ? "rgba(52,211,153,0.05)" : "rgba(251,191,36,0.05)",
      }}>
      <span className="mt-0.5 flex-shrink-0">
        {isConnected
          ? <Wifi className="h-4 w-4 text-emerald-400" />
          : <WifiOff className="h-4 w-4 text-amber-400" />}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold" style={{ color: isConnected ? "var(--category-performance)" : "#fbbf24" }}>
          {isConnected ? `Connected — ${platform}` : "Site not connected"}
        </p>
        <p className="text-xs text-white/50 leading-relaxed">
          {isConnected
            ? "Fix instructions will be tailored for your platform."
            : "Fixes will be code instructions only. "}
          {!isConnected && (
            <a
              href={`../../cockpit`}
              className="underline text-amber-400 hover:text-amber-300"
            >
              Connect your site
            </a>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SEOFixerPanel({
  siteId,
  jobId,
  queuedItems,
  tokensRemaining,
  showTokenCost = true,
  connectionStatus,
  cmsType,
  onClose,
}: SEOFixerPanelProps) {
  const [step, setStep] = useState<Step>("preflight");
  const [items, setItems] = useState<FixItem[]>(
    queuedItems.map((q) => ({ ...q, status: "queued" as FixStatus })),
  );
  const [done, setDone] = useState<FixerDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<"done" | "error" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAt = useRef<Date | null>(null);

  // Derived counts
  const codeCount    = queuedItems.filter((i) => i.fixType === "code").length;
  const contentCount = queuedItems.filter((i) => i.fixType === "content").length;
  const configCount  = queuedItems.filter((i) => i.fixType === "config").length;
  const manualCount  = queuedItems.filter((i) => i.fixType === "manual").length;
  const actionable   = queuedItems.filter((i) => i.fixType !== "manual").length;
  const estTokens    = estimateTokenCost(queuedItems);
  const backupId     = `bkp_${jobId.slice(0, 8)}`;

  const appliedCount = items.filter((it) => it.status === "done").length;
  const failedCount  = items.filter((it) => it.status === "failed").length;
  const doneCount    = items.filter((it) => it.status === "done" || it.status === "failed" || it.status === "skipped").length;

  const addOrUpdateItem = useCallback((patch: Partial<FixItem> & { id: string }) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === patch.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...patch };
        return updated;
      }
      return [...prev, { title: patch.id, status: "skipped", ...patch } as FixItem];
    });
  }, []);

  const startRepair = useCallback(async () => {
    startedAt.current = new Date();
    setStep("running");
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
          try { ev = JSON.parse(t) as Record<string, unknown>; }
          catch { continue; }

          if (ev.type === "error") throw new Error(ev.message as string);

          if (ev.type === "fix_item") {
            addOrUpdateItem({
              id:             ev.id as string,
              title:          ev.title as string,
              severity:       ev.severity as string | undefined,
              section:        ev.section as string | undefined,
              status:         ev.status as FixStatus,
              detail:         ev.detail as string | undefined,
              steps:          ev.steps as string[] | undefined,
              snippet:        ev.snippet as string | undefined,
              expectedImpact: ev.expectedImpact as string | undefined,
              reason:         ev.reason as string | undefined,
            });
          } else if (ev.type === "done") {
            setDone({
              applied:         ev.applied as number,
              skipped:         ev.skipped as number,
              totalTokensUsed: ev.totalTokensUsed as number,
            });
            setStep("results");
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Fixer failed");
        setStep("results");
      }
    }
  }, [siteId, jobId, addOrUpdateItem]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/repair-queue/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRestoreResult("done");
    } catch {
      setRestoreResult("error");
    } finally {
      setRestoring(false);
    }
  }, [siteId, jobId]);

  function savedAgo(): string {
    if (!startedAt.current) return "just now";
    const diffMs = Date.now() - startedAt.current.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    return `${mins}m ago`;
  }

  // ── Shared sticky header ─────────────────────────────────────────────────

  const header = (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 py-3 border-b flex-shrink-0"
      style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
    >
      <button
        onClick={onClose}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
        aria-label="Back to report"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: "oklch(from var(--category-seo) l c h / 0.12)", color: "var(--category-seo)" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-white">{AGENT_NAME} SEO Fixer</h1>
        <p className="text-xs text-white/40">
          {step === "preflight" && `${queuedItems.length} issue${queuedItems.length === 1 ? "" : "s"} queued`}
          {step === "running"   && `Elaborating ${items.length} fix${items.length === 1 ? "" : "es"}…`}
          {step === "results"   && done && `${done.applied} applied · ${done.skipped} manual · ${failedCount} failed`}
          {step === "results"   && !done && "Repair complete"}
        </p>
      </div>
      {step === "running" && (
        <span className="flex items-center gap-1.5 text-xs text-white/40 flex-shrink-0">
          <Loader2 className="h-3 w-3 animate-spin" />
          Working…
        </span>
      )}
      {step === "results" && done && (
        <span className="flex items-center gap-1.5 text-xs text-green-400 flex-shrink-0">
          <CheckCircle className="h-3 w-3" /> Done
        </span>
      )}
    </header>
  );

  // ── Step 1: Pre-flight ───────────────────────────────────────────────────

  if (step === "preflight") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--background-default)" }}>
        {header}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5 pb-10">

          {/* Connection status */}
          <ConnectionBadge
            connectionStatus={connectionStatus}
            cmsType={cmsType}
            siteId={siteId}
          />

          {/* Auto-backup notice */}
          <div className="rounded-xl border p-4 flex items-start gap-3"
            style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)" }}>
            <Shield className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">Auto-Backup</p>
              <p className="text-xs text-white/50 leading-relaxed">
                A snapshot of your current SEO config will be saved before any change.
                Backup ID: <span className="font-mono text-white/70">{backupId}</span>
              </p>
            </div>
          </div>

          {/* Issue breakdown */}
          <div className="rounded-xl border p-5 space-y-4"
            style={{ borderColor: "var(--border-default)", background: "var(--header-bg, var(--background-default))" }}>
            <p className="text-sm font-semibold text-white">
              {queuedItems.length} issue{queuedItems.length === 1 ? "" : "s"} selected
            </p>
            <div className="space-y-2">
              {codeCount > 0 && (
                <div className="flex items-center gap-2.5">
                  <FileCode2 className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                  <span className="text-sm text-white/80">{codeCount} code fix{codeCount === 1 ? "" : "es"}</span>
                </div>
              )}
              {contentCount > 0 && (
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                  <span className="text-sm text-white/80">{contentCount} content fix{contentCount === 1 ? "" : "es"}</span>
                </div>
              )}
              {configCount > 0 && (
                <div className="flex items-center gap-2.5">
                  <Settings2 className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                  <span className="text-sm text-white/80">{configCount} config fix{configCount === 1 ? "" : "es"}</span>
                </div>
              )}
              {manualCount > 0 && (
                <div className="flex items-center gap-2.5">
                  <SkipForward className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                  <span className="text-sm text-white/50">{manualCount} manual (will be shown as instructions)</span>
                </div>
              )}
            </div>

            {showTokenCost && actionable > 0 && (
              <div className="pt-3 border-t space-y-1.5" style={{ borderColor: "var(--border-default)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Est. token cost</span>
                  <span className="text-white/70 font-medium">~{estTokens.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Tokens remaining</span>
                  <span className={cn("font-medium", tokensRemaining < estTokens ? "text-red-400" : "text-white/70")}>
                    {tokensRemaining.toLocaleString()}
                  </span>
                </div>
                {tokensRemaining < estTokens && (
                  <p className="text-xs text-red-400 pt-1">
                    Estimated cost exceeds your remaining balance — some fixes may be skipped.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 border transition-colors hover:text-white hover:bg-white/5"
              style={{ borderColor: "var(--border-default)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => void startRepair()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "var(--category-seo)",
                boxShadow: "0 0 20px oklch(from var(--category-seo) l c h / 0.35)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Start Repair
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Step 2: Running ──────────────────────────────────────────────────────

  if (step === "running") {
    const progressPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--background-default)" }}>
        {header}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 space-y-3 pb-32">

          {/* Backup created */}
          <div className="flex items-center gap-2 px-1 py-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <p className="text-xs text-white/50">
              Backup saved — <span className="font-mono text-white/60">{backupId}</span>
            </p>
          </div>

          {items.map((item) => <FixCard key={item.id} item={item} />)}

          {/* Spinner while still streaming */}
          <p className="text-xs text-white/30 flex items-center gap-1.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {AGENT_NAME} is working through your queue…
          </p>
        </main>

        {/* Sticky progress footer */}
        <footer
          className="fixed bottom-0 left-0 right-0 z-20 border-t px-4 sm:px-6 py-4 space-y-2"
          style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
        >
          <div className="flex items-center justify-between text-xs text-white/40 mb-1">
            <span>Progress</span>
            <span>{doneCount} / {items.length}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border-default)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: "var(--category-seo)",
                boxShadow: progressPct > 0 ? "0 0 8px oklch(from var(--category-seo) l c h / 0.5)" : undefined,
              }}
            />
          </div>
        </footer>
      </div>
    );
  }

  // ── Step 3: Results ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background-default)" }}>
      {header}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5 pb-10">

        {/* Error banner (if stream failed before done event) */}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Fixer error</p>
              <p className="text-xs text-red-300/70">{error}</p>
            </div>
          </div>
        )}

        {/* Summary stats */}
        {done && (
          <div className="rounded-xl border p-5 space-y-3"
            style={{ borderColor: "rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.04)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
              <p className="text-base font-bold text-white">
                {done.applied} fix{done.applied === 1 ? "" : "es"} elaborated
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {done.skipped > 0 && (
                <span className="text-white/40">{done.skipped} manual (instructions provided)</span>
              )}
              {failedCount > 0 && (
                <span className="text-red-400">{failedCount} failed</span>
              )}
            </div>
            {showTokenCost && done.totalTokensUsed > 0 && (
              <p className="text-xs text-white/30 pt-1 border-t" style={{ borderColor: "rgba(52,211,153,0.1)" }}>
                {done.totalTokensUsed.toLocaleString()} tokens used by {AGENT_NAME}.
              </p>
            )}
          </div>
        )}

        {/* Fix items collapsed view */}
        <div className="space-y-2.5">
          {items.map((item) => <FixCard key={item.id} item={item} />)}
        </div>

        {/* Diff / patch stubs */}
        <div className="flex gap-3">
          <button
            disabled
            title="Coming soon"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/30 border cursor-not-allowed"
            style={{ borderColor: "var(--border-default)" }}
          >
            <GitCompare className="h-3.5 w-3.5" />
            View diff
          </button>
          <button
            disabled
            title="Coming soon"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/30 border cursor-not-allowed"
            style={{ borderColor: "var(--border-default)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Download patch
          </button>
        </div>

        {/* Restore section */}
        <div className="rounded-xl border p-5 space-y-3"
          style={{ borderColor: "var(--border-default)", background: "var(--header-bg, var(--background-default))" }}>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-white/40 flex-shrink-0" />
            <p className="text-sm font-semibold text-white/80">Restore backup if something broke</p>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Backup: <span className="font-mono text-white/60">{backupId}</span>
            {startedAt.current && (
              <span className="ml-2">· saved {savedAgo()}</span>
            )}
          </p>

          {restoreResult === "done" && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="h-3.5 w-3.5" />
              Fixes reset — you can re-run {AGENT_NAME} on this job.
            </div>
          )}
          {restoreResult === "error" && (
            <p className="text-xs text-red-400">Restore failed — please try again.</p>
          )}

          <button
            onClick={() => void handleRestore()}
            disabled={restoring || restoreResult === "done"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
              restoring || restoreResult === "done"
                ? "text-white/30 cursor-not-allowed border-white/8"
                : "text-white/70 hover:text-white hover:bg-white/5 border-white/15",
            )}
          >
            {restoring
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Restoring…</>
              : <><RotateCcw className="h-3.5 w-3.5" /> Restore original</>}
          </button>
        </div>

        {/* Return CTA */}
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: "var(--category-seo)", boxShadow: "0 0 20px oklch(from var(--category-seo) l c h / 0.35)" }}
        >
          Close &amp; return to report
        </button>

      </main>
    </div>
  );
}
