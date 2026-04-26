"use client";

// SEOAnalysisDrawer.tsx
// Slide-over drawer that streams the live SEO-GEO audit from Claude Opus 4.7.
// Opens immediately with a skeleton, findings stream in card by card.
// 8 section cards, severity badges, repair-queue checkboxes, master score gauge.

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenUsageBar } from "@/components/ui/TokenUsageBar";
import { AGENT_NAME } from "@/lib/ai/constants";
import type { SeoFinding, SeoMasterScore, SeoSection } from "@/lib/db/schema/ai/analysis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StreamEvent {
  type: "job_started" | "finding" | "master_score" | "done" | "error";
  [key: string]: unknown;
}

interface JobStarted {
  type: "job_started";
  jobId: string;
  siteUrl: string;
  userName?: string;
  tier: string;
  modelLabel: string;
  estimatedTokenCost: number;
}

interface DoneEvent {
  type: "done";
  jobId: string;
  totalFindings: number;
  totalTokensUsed: number;
  tokensRemaining: number;
}

export interface SEOAnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteUrl: string;
  /** Team's current monthly token balance (for the usage bar) */
  tokensIncluded: number;
  tokensUsedThisMonth: number;
  agentName?: string;
}

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

const SECTIONS: Record<SeoSection, { label: string; description: string; maxScore: number }> = {
  "technical-seo": {
    label: "Technical SEO",
    description: "Indexability, canonicals, HTTPS, sitemap, URL structure, on-page signals, mobile & Core Web Vitals",
    maxScore: 100,
  },
  "content-eeat": {
    label: "Content & E-E-A-T",
    description: "Content quality, E-E-A-T signals, structured data (Organization, FAQ, Product, Article…)",
    maxScore: 25,
  },
  "ai-seo": {
    label: "AI SEO",
    description: "AI-readable structure, summarizability, entity density, fact consistency",
    maxScore: 30,
  },
  geo: {
    label: "GEO",
    description: "Generative Engine Optimization — visibility in Gemini, ChatGPT, Perplexity, Claude",
    maxScore: 30,
  },
  aeo: {
    label: "AEO",
    description: "Answer Engine Optimization — Q&A depth, conversational queries, voice-friendly content",
    maxScore: 25,
  },
  "author-seo": {
    label: "Author SEO",
    description: "Author identity markup, expertise verification, authority & trust signals",
    maxScore: 25,
  },
  "ai-analytics": {
    label: "AI Analytics & Citations",
    description: "AI search impressions, answer share, citation frequency, attribution tracking",
    maxScore: 25,
  },
  "llms-txt": {
    label: "llms.txt",
    description: "LLM crawler permissions — presence, model-specific rules, attribution requirements",
    maxScore: 25,
  },
};

const SECTION_ORDER: SeoSection[] = [
  "technical-seo",
  "content-eeat",
  "ai-seo",
  "geo",
  "aeo",
  "author-seo",
  "ai-analytics",
  "llms-txt",
];

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

type Severity = "critical" | "high" | "medium" | "low";

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: typeof AlertCircle }> = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", icon: AlertCircle },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30", icon: AlertTriangle },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: AlertTriangle },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30", icon: Info },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border", cfg.bg, cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ScorePips({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            i <= score ? "bg-[var(--category-seo)]" : "bg-white/10",
          )}
        />
      ))}
    </span>
  );
}

function FindingCard({
  finding,
  checked,
  onToggle,
}: {
  finding: SeoFinding;
  checked: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const severity = (finding.severity ?? "low") as Severity;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-all duration-200",
        checked
          ? "border-[var(--category-seo)]/50 bg-[var(--category-seo)]/5"
          : "border-white/8 bg-white/3",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Repair-queue checkbox */}
        <button
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border border-white/20 flex items-center justify-center transition-colors"
          style={checked ? { background: "var(--category-seo)", borderColor: "var(--category-seo)" } : {}}
          aria-label={checked ? "Remove from repair queue" : "Add to repair queue"}
        >
          {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={severity} />
            <ScorePips score={finding.score ?? 0} />
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{finding.title}</p>
        </div>
      </div>

      {/* Impact */}
      <p className="text-xs leading-relaxed text-white/55 pl-7">{finding.impact}</p>

      {/* Fix block — collapsible */}
      {finding.automatedFix && (
        <div className="pl-7">
          <button
            className="flex items-center gap-1.5 text-xs text-[var(--category-seo)] hover:opacity-80 transition-opacity"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide fix" : "Show fix"}
            <span className="text-white/30 capitalize">· {finding.automatedFix.effort} effort</span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-white/70">{finding.automatedFix.description}</p>
              {finding.automatedFix.snippet && (
                <pre className="rounded-lg bg-black/40 border border-white/8 p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {finding.automatedFix.snippet}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section,
  findings,
  checkedIds,
  onToggle,
  loading,
}: {
  section: SeoSection;
  findings: SeoFinding[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  loading: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = SECTIONS[section];
  const critCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const avgScore = findings.length
    ? Math.round(findings.reduce((s, f) => s + (f.score ?? 0), 0) / findings.length)
    : 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/4 transition-colors text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <ScorePips score={avgScore} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white">{cfg.label}</h4>
            <p className="text-xs text-white/40 truncate">{cfg.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {loading && findings.length === 0 && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
          )}
          {critCount > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-400/15 text-red-400">
              {critCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-orange-400/15 text-orange-400">
              {highCount} high
            </span>
          )}
          <span className="text-xs text-white/30">{findings.length} findings</span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/30" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/30" />
          )}
        </div>
      </button>

      {/* Findings list */}
      {!collapsed && (
        <div className="px-5 pb-5 space-y-3">
          {findings.length === 0 && loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-white/4 animate-pulse" />
              ))}
            </div>
          )}
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              checked={checkedIds.has(f.id)}
              onToggle={() => onToggle(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Master score gauge
// ---------------------------------------------------------------------------

function MasterScoreGauge({ score }: { score: SeoMasterScore | null }) {
  const SUB_SCORES: Array<{ key: keyof SeoMasterScore; label: string; max: number }> = [
    { key: "technicalSeo", label: "Technical SEO", max: 100 },
    { key: "aiSeo", label: "AI SEO", max: 30 },
    { key: "geo", label: "GEO", max: 30 },
    { key: "aeo", label: "AEO", max: 25 },
    { key: "authorSeo", label: "Author SEO", max: 25 },
    { key: "aiAnalytics", label: "AI Analytics", max: 25 },
    { key: "aiCitation", label: "AI Citations", max: 25 },
    { key: "llmsTxt", label: "llms.txt", max: 25 },
  ];

  return (
    <div className="rounded-2xl border border-[var(--category-seo)]/20 bg-[var(--category-seo)]/5 p-5 space-y-4">
      {/* Master score */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">AI-SEO Master Score</p>
          {score ? (
            <p className="text-4xl font-bold text-white mt-1">
              {score.master}
              <span className="text-lg text-white/40 font-normal"> / 100</span>
            </p>
          ) : (
            <div className="h-10 w-24 rounded bg-white/8 animate-pulse mt-1" />
          )}
        </div>
        {score && (
          <div className="text-right">
            <p className="text-xs text-white/40">{score.modelId}</p>
            <p className="text-xs text-white/30">{score.totalTokensUsed.toLocaleString()} tokens</p>
          </div>
        )}
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {SUB_SCORES.map(({ key, label, max }) => {
          const val = score ? (score[key] as number) : null;
          const pct = val !== null ? val / max : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{label}</span>
                {val !== null ? (
                  <span className="font-medium text-white/80">
                    {val} / {max}
                  </span>
                ) : (
                  <span className="w-10 h-3 rounded bg-white/8 animate-pulse" />
                )}
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct * 100}%`,
                    background: "var(--category-seo)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro text
// ---------------------------------------------------------------------------

function IntroText({
  userName,
  siteUrl,
  streaming,
  agentName,
}: {
  userName?: string;
  siteUrl: string;
  streaming: boolean;
  agentName: string;
}) {
  const domain = (() => {
    try { return new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { return siteUrl; }
  })();

  const greeting = userName ? `Hi ${userName},` : "Hi there,";

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-white">
        {greeting}{" "}
        {streaming ? (
          <span className="text-white/60">
            {agentName} is analysing <span className="text-white">{domain}</span>…
          </span>
        ) : (
          <span className="text-white/60">
            here's your SEO-GEO audit for <span className="text-white">{domain}</span>
          </span>
        )}
      </p>
      <p className="text-xs text-white/40 leading-relaxed max-w-lg">
        {streaming
          ? "Findings are appearing live as the AI analyses each section. Check the items you want to add to your repair queue."
          : "Review the findings below. Check each issue you want to fix, then launch Sparky to apply them automatically."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export function SEOAnalysisDrawer({
  open,
  onClose,
  siteId,
  siteUrl,
  tokensIncluded,
  tokensUsedThisMonth,
  agentName = AGENT_NAME,
}: SEOAnalysisDrawerProps) {
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobMeta, setJobMeta] = useState<JobStarted | null>(null);
  const [findings, setFindings] = useState<SeoFinding[]>([]);
  const [masterScore, setMasterScore] = useState<SeoMasterScore | null>(null);
  const [doneEvent, setDoneEvent] = useState<DoneEvent | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [queueSaving, setQueueSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const hasStarted = useRef(false);

  // Group findings by section
  const findingsBySection: Record<SeoSection, SeoFinding[]> = {
    "technical-seo": [], "content-eeat": [], "ai-seo": [], geo: [],
    aeo: [], "author-seo": [], "ai-analytics": [], "llms-txt": [],
  };
  for (const f of findings) {
    if (f.section && findingsBySection[f.section]) {
      findingsBySection[f.section].push(f);
    }
  }

  const startStream = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setStreaming(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/sites/${siteId}/analyze-seo/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as StreamEvent;

            if (event.type === "job_started") {
              setJobMeta(event as unknown as JobStarted);
            } else if (event.type === "finding") {
              setFindings((prev) => [...prev, event as unknown as SeoFinding]);
            } else if (event.type === "master_score") {
              setMasterScore(event as unknown as SeoMasterScore);
            } else if (event.type === "done") {
              setDoneEvent(event as unknown as DoneEvent);
              setDone(true);
            } else if (event.type === "error") {
              throw new Error((event as unknown as { message: string }).message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Analysis failed");
      }
    } finally {
      setStreaming(false);
    }
  }, [siteId]);

  // Start stream when drawer opens
  useEffect(() => {
    if (open && !hasStarted.current) {
      startStream();
    }
    return () => {
      if (!open) {
        abortRef.current?.abort();
      }
    };
  }, [open, startStream]);

  // Reset when drawer closes
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    hasStarted.current = false;
    setStreaming(false);
    setDone(false);
    setError(null);
    setJobMeta(null);
    setFindings([]);
    setMasterScore(null);
    setDoneEvent(null);
    setCheckedIds(new Set());
    onClose();
  }, [onClose]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const checkedCount = checkedIds.size;

  // Add checked findings to repair queue
  const addToRepairQueue = useCallback(async () => {
    if (!jobMeta?.jobId || checkedCount === 0) return;
    setQueueSaving(true);
    try {
      await fetch(`/api/sites/${siteId}/repair-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobMeta.jobId,
          issueIds: Array.from(checkedIds),
        }),
      });
    } finally {
      setQueueSaving(false);
    }
  }, [siteId, jobMeta, checkedIds, checkedCount]);

  // Token numbers for usage bar
  const totalTokensUsed = doneEvent?.totalTokensUsed ?? 0;
  const liveTokensUsed = tokensUsedThisMonth + totalTokensUsed;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SEO GEO Analysis"
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-2xl shadow-2xl"
        style={{ background: "var(--background-default)", borderLeft: "1px solid var(--border-default)" }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--category-seo) l c h / 0.12)", color: "var(--category-seo)" }}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">SEO GEO Analysis</h2>
              <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {streaming && "Live audit running…"}
                {done && `${findings.length} findings across 8 sections`}
                {error && "Analysis error"}
                {!streaming && !done && !error && "Starting…"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Intro */}
          <IntroText
            userName={jobMeta?.userName}
            siteUrl={siteUrl}
            streaming={streaming}
            agentName={agentName}
          />

          {/* Error state */}
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Master score gauge */}
          <MasterScoreGauge score={masterScore} />

          {/* 8 section cards */}
          <div className="space-y-3">
            {SECTION_ORDER.map((section) => (
              <SectionCard
                key={section}
                section={section}
                findings={findingsBySection[section]}
                checkedIds={checkedIds}
                onToggle={toggleChecked}
                loading={streaming}
              />
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="border-t px-6 py-4 space-y-3"
          style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
        >
          {/* Token usage bar */}
          <TokenUsageBar
            tokensUsed={liveTokensUsed}
            tokensTotal={tokensIncluded}
            tokensConsumedThisAnalysis={totalTokensUsed}
            modelLabel={jobMeta?.modelLabel ?? "AI"}
          />

          {/* CTA row */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/40">
              {checkedCount > 0
                ? `${checkedCount} issue${checkedCount === 1 ? "" : "s"} selected for repair`
                : "Check issues above to add to repair queue"}
            </p>

            <button
              onClick={addToRepairQueue}
              disabled={checkedCount === 0 || queueSaving || !done}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                checkedCount > 0 && done
                  ? "text-white"
                  : "text-white/30 cursor-not-allowed",
              )}
              style={
                checkedCount > 0 && done
                  ? {
                      background: "var(--category-seo)",
                      boxShadow: "0 0 20px oklch(from var(--category-seo) l c h / 0.35)",
                    }
                  : { background: "var(--border-default)" }
              }
            >
              {queueSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Fix with {agentName} (AI Agent)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
