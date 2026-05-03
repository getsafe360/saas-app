"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertTriangle, AlertCircle, Info,
  Sparkles, ChevronDown, ChevronUp, FileText, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TokenUsageBar } from "@/components/ui/TokenUsageBar";
import { SEOFixerPanel } from "./SEOFixerPanel";
import { AGENT_NAME } from "@/lib/ai/constants";
import type { SeoFinding, SeoMasterScore, SeoSection } from "@/lib/db/schema/ai/analysis";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StreamEvent { type: string; [key: string]: unknown; }
interface JobStarted {
  type: "job_started"; jobId: string; siteUrl: string;
  userName?: string; tier: string; modelLabel: string; estimatedTokenCost: number;
}
interface DoneEvent {
  type: "done"; jobId: string; totalFindings: number;
  totalTokensUsed: number; tokensRemaining: number;
}

export interface SEOAnalysisPageProps {
  siteId: string;
  siteUrl: string;
  locale: string;
  autoStart?: boolean;
  tokensIncluded?: number;
  tokensUsedThisMonth?: number;
  /** Controlled by plan: agent/agency/business users see only a minimal bar, no raw counts */
  showTokenCost?: boolean;
  connectionStatus?: ConnectionStatus;
  cmsType?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECTIONS: Record<SeoSection, { label: string; description: string; maxScore: number }> = {
  "technical-seo": { label: "Technical SEO", description: "Indexability, canonicals, HTTPS, sitemap, URL structure, on-page signals, mobile & Core Web Vitals", maxScore: 100 },
  "content-eeat": { label: "Content & E-E-A-T", description: "Content quality, E-E-A-T signals, structured data (Organization, FAQ, Product, Article…)", maxScore: 25 },
  "ai-seo": { label: "AI SEO", description: "AI-readable structure, summarizability, entity density, fact consistency", maxScore: 30 },
  geo: { label: "GEO", description: "Generative Engine Optimization — visibility in Gemini, ChatGPT, Perplexity, Claude", maxScore: 30 },
  aeo: { label: "AEO", description: "Answer Engine Optimization — Q&A depth, conversational queries, voice-friendly content", maxScore: 25 },
  "author-seo": { label: "Author SEO", description: "Author identity markup, expertise verification, authority & trust signals", maxScore: 25 },
  "ai-analytics": { label: "AI Analytics & Citations", description: "AI search impressions, answer share, citation frequency, attribution tracking", maxScore: 25 },
  "llms-txt": { label: "llms.txt", description: "LLM crawler permissions — presence, model-specific rules, attribution requirements", maxScore: 25 },
};

const TAB_GROUPS = [
  { id: "technical",     label: "Technical & Content", sections: ["technical-seo", "content-eeat"] as SeoSection[] },
  { id: "ai-visibility", label: "AI Visibility",        sections: ["ai-seo", "geo", "aeo"] as SeoSection[] },
  { id: "authority",     label: "Authority",            sections: ["author-seo", "ai-analytics"] as SeoSection[] },
];
const PINNED_SECTION: SeoSection = "llms-txt";

type Severity = "critical" | "high" | "medium" | "low";
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; icon: typeof AlertCircle }> = {
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    icon: AlertCircle },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30", icon: AlertTriangle },
  medium:   { label: "Medium",   color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30",  icon: AlertTriangle },
  low:      { label: "Low",      color: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/30",   icon: Info },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity, passed }: { severity: Severity; passed?: boolean }) {
  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400">
        ✓ Good
      </span>
    );
  }
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border", cfg.bg, cfg.border, cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ScorePips({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-2 w-2 rounded-full", i <= score ? "bg-[var(--category-seo)]" : "bg-white/10")} />
      ))}
    </span>
  );
}

function CircularScore({ score }: { score: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : score >= 40 ? "#f97316" : "#f87171";
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="60" y="60" textAnchor="middle" dy="0.35em" fontSize="26" fontWeight="700" fill="white">{score}</text>
    </svg>
  );
}

function MasterScoreHero({ score, streaming }: { score: SeoMasterScore | null; streaming: boolean }) {
  const SUB: Array<{ key: keyof SeoMasterScore; label: string; max: number }> = [
    { key: "technicalSeo", label: "Technical SEO", max: 100 },
    { key: "contentEeat",  label: "Content & E-E-A-T", max: 25 },
    { key: "aiSeo",        label: "AI SEO", max: 30 },
    { key: "geo",          label: "GEO", max: 30 },
    { key: "aeo",          label: "AEO", max: 25 },
    { key: "authorSeo",    label: "Author SEO", max: 25 },
    { key: "aiAnalytics",  label: "AI Analytics & Citations", max: 25 },
    { key: "llmsTxt",      label: "llms.txt", max: 25 },
  ];

  return (
    <div className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: "oklch(from var(--category-seo) l c h / 0.2)", background: "oklch(from var(--category-seo) l c h / 0.06)" }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {score ? <CircularScore score={score.master} /> : (
          <div className="h-[120px] w-[120px] rounded-full bg-white/5 animate-pulse flex-shrink-0" />
        )}
        <div className="flex-1 space-y-1">
          <p className="text-xs uppercase tracking-widest text-white/40">AI-SEO Master Score</p>
          {score ? (
            <>
              <p className="text-3xl font-bold text-white">{score.master}<span className="text-base text-white/40 font-normal"> / 100</span></p>
              <p className="text-xs text-white/40">{score.modelId} · {score.totalTokensUsed.toLocaleString()} tokens used</p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-8 w-28 rounded bg-white/8 animate-pulse" />
              <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        {SUB.map(({ key, label, max }) => {
          const val = score ? (score[key] as number) : null;
          const pct = val !== null ? (val / max) * 100 : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">{label}</span>
                {val !== null
                  ? <span className="text-white/80 font-medium">{val}/{max}</span>
                  : <span className="w-10 h-3 rounded bg-white/8 animate-pulse inline-block" />}
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: "var(--category-seo)" }} />
              </div>
            </div>
          );
        })}
      </div>
      {streaming && (
        <p className="text-xs text-white/30 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Score will update when analysis completes…
        </p>
      )}
    </div>
  );
}

function FindingCard({ finding, checked, onToggle }: { finding: SeoFinding; checked: boolean; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const severity = (finding.severity ?? "low") as Severity;
  const isPassed = finding.passed === true;

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3 transition-all duration-200",
      isPassed ? "border-green-500/20 bg-green-500/5 opacity-80"
        : checked ? "border-[var(--category-seo)]/50 bg-[var(--category-seo)]/5"
        : "border-white/8 bg-white/3",
    )}>
      <div className="flex items-start gap-3">
        {!isPassed ? (
          <button onClick={onToggle}
            className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border border-white/20 flex items-center justify-center transition-colors"
            style={checked ? { background: "var(--category-seo)", borderColor: "var(--category-seo)" } : {}}
            aria-label={checked ? "Remove from repair queue" : "Add to repair queue"}>
            {checked && <span className="text-[10px] font-bold text-white leading-none">✓</span>}
          </button>
        ) : <div className="mt-0.5 flex-shrink-0 h-4 w-4" />}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={severity} passed={isPassed} />
            <ScorePips score={finding.score ?? 0} />
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{finding.title}</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/55 pl-7">{finding.impact}</p>

      {finding.automatedFix && !isPassed && (
        <div className="pl-7">
          <button className="flex items-center gap-1.5 text-xs text-[var(--category-seo)] hover:opacity-80 transition-opacity"
            onClick={() => setExpanded(v => !v)}>
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

function BulkSelectBar({ findings, checkedIds, onBulkToggle }: {
  findings: SeoFinding[];
  checkedIds: Set<string>;
  onBulkToggle: (ids: string[], allChecked: boolean) => void;
}) {
  const severities: Severity[] = ["critical", "high", "medium", "low"];
  const hasAny = severities.some(sev => findings.some(f => f.severity === sev && !f.passed));
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-1">
      <span className="text-xs text-white/40">Select:</span>
      {severities.map(sev => {
        const group = findings.filter(f => f.severity === sev && !f.passed);
        if (group.length === 0) return null;
        const allChecked = group.every(f => checkedIds.has(f.id));
        const cfg = SEVERITY_CONFIG[sev];
        return (
          <button key={sev}
            onClick={() => onBulkToggle(group.map(f => f.id), allChecked)}
            className={cn("text-xs px-2.5 py-1 rounded-lg border font-medium transition-opacity hover:opacity-80", cfg.bg, cfg.border, cfg.color)}>
            {allChecked ? "− " : "+ "}{cfg.label} ({group.length})
          </button>
        );
      })}
    </div>
  );
}

function SectionGroup({ section, findings, checkedIds, onToggle, loading }: {
  section: SeoSection; findings: SeoFinding[];
  checkedIds: Set<string>; onToggle: (id: string) => void; loading: boolean;
}) {
  const cfg = SECTIONS[section];
  const critCount = findings.filter(f => f.severity === "critical" && !f.passed).length;
  const highCount = findings.filter(f => f.severity === "high" && !f.passed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" />
        <div className="flex items-center gap-2 text-xs text-white/40 font-semibold uppercase tracking-wider whitespace-nowrap">
          {cfg.label}
          {findings.length > 0 && <span className="normal-case font-normal">({findings.length})</span>}
          {critCount > 0 && <span className="text-red-400 normal-case">{critCount} critical</span>}
          {highCount > 0 && <span className="text-orange-400 normal-case">{highCount} high</span>}
        </div>
        <div className="h-px flex-1 bg-white/8" />
      </div>
      {findings.length === 0 && loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-white/4 animate-pulse" />)}
        </div>
      ) : (
        findings.map(f => (
          <FindingCard key={f.id} finding={f} checked={checkedIds.has(f.id)} onToggle={() => onToggle(f.id)} />
        ))
      )}
    </div>
  );
}

function LlmsTxtCard({ findings, checkedIds, onToggle, loading }: {
  findings: SeoFinding[]; checkedIds: Set<string>;
  onToggle: (id: string) => void; loading: boolean;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "oklch(from var(--category-seo) l c h / 0.15)", background: "oklch(from var(--category-seo) l c h / 0.05)" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: "var(--category-seo)" }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">llms.txt</h3>
          <p className="text-xs text-white/40 truncate">{SECTIONS["llms-txt"].description}</p>
        </div>
        <span className="text-xs text-white/30 flex-shrink-0">{findings.length} findings</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        {findings.length === 0 && loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-white/4 animate-pulse" />)}
          </div>
        ) : findings.length === 0 && !loading ? (
          <p className="text-xs text-white/30 py-2">No findings — analysis pending or no data available.</p>
        ) : (
          findings.map(f => (
            <FindingCard key={f.id} finding={f} checked={checkedIds.has(f.id)} onToggle={() => onToggle(f.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SEOAnalysisPage({
  siteId, siteUrl, locale, autoStart = false,
  tokensIncluded: tokensIncludedProp,
  tokensUsedThisMonth: tokensUsedProp,
  showTokenCost = true,
  connectionStatus,
  cmsType,
}: SEOAnalysisPageProps) {
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobMeta, setJobMeta] = useState<JobStarted | null>(null);
  const [findings, setFindings] = useState<SeoFinding[]>([]);
  const [masterScore, setMasterScore] = useState<SeoMasterScore | null>(null);
  const [doneEvent, setDoneEvent] = useState<DoneEvent | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [queueSaving, setQueueSaving] = useState(false);
  const [fixerOpen, setFixerOpen] = useState(false);
  // Token balance is always provided by the server page (pre-analysis snapshot),
  // so there is no client-side fetch that could race with the stream.
  const tokenBalance = {
    tokensIncluded: tokensIncludedProp ?? 5000,
    tokensUsedThisMonth: tokensUsedProp ?? 0,
  };

  const abortRef = useRef<AbortController | null>(null);
  const hasStarted = useRef(false);

  // Group findings by section
  const findingsBySection: Record<SeoSection, SeoFinding[]> = {
    "technical-seo": [], "content-eeat": [], "ai-seo": [], geo: [],
    aeo: [], "author-seo": [], "ai-analytics": [], "llms-txt": [],
  };
  for (const f of findings) {
    if (f.section && findingsBySection[f.section]) findingsBySection[f.section].push(f);
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
            if (event.type === "job_started") setJobMeta(event as unknown as JobStarted);
            else if (event.type === "finding") setFindings(prev => [...prev, event as unknown as SeoFinding]);
            else if (event.type === "master_score") setMasterScore(event as unknown as SeoMasterScore);
            else if (event.type === "done") { setDoneEvent(event as unknown as DoneEvent); setDone(true); }
            else if (event.type === "error") throw new Error((event as unknown as { message: string }).message);
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message ?? "Analysis failed");
    } finally {
      setStreaming(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (autoStart && !hasStarted.current) startStream();
    return () => { abortRef.current?.abort(); };
  }, [autoStart, startStream]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleBulkToggle = useCallback((ids: string[], allChecked: boolean) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      if (allChecked) ids.forEach(id => n.delete(id));
      else ids.forEach(id => n.add(id));
      return n;
    });
  }, []);

  const addToRepairQueue = useCallback(async () => {
    if (!jobMeta?.jobId || checkedIds.size === 0) return;
    setQueueSaving(true);
    try {
      await fetch(`/api/sites/${siteId}/repair-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: jobMeta.jobId, issueIds: Array.from(checkedIds) }),
      });
      // Open the fixer panel immediately after queuing
      setFixerOpen(true);
    } finally { setQueueSaving(false); }
  }, [siteId, jobMeta, checkedIds]);

  const domain = (() => { try { return new URL(siteUrl).hostname.replace(/^www\./, ""); } catch { return siteUrl; } })();
  const totalTokensUsed = doneEvent?.totalTokensUsed ?? 0;
  // When done, derive usage from server-authoritative tokensRemaining to avoid
  // double-counting if the token balance fetch resolved after the backend debit.
  const liveTokensUsed = done && doneEvent
    ? tokenBalance.tokensIncluded - doneEvent.tokensRemaining
    : tokenBalance.tokensUsedThisMonth + totalTokensUsed;
  const checkedCount = checkedIds.size;

  // Per-tab finding aggregation for tab badges
  function tabFindings(sections: SeoSection[]) {
    return sections.flatMap(s => findingsBySection[s]);
  }
  function tabCritCount(sections: SeoSection[]) {
    return tabFindings(sections).filter(f => f.severity === "critical" && !f.passed).length;
  }
  function tabHighCount(sections: SeoSection[]) {
    return tabFindings(sections).filter(f => f.severity === "high" && !f.passed).length;
  }

  const fixerTokensRemaining = done && doneEvent
    ? Math.max(0, doneEvent.tokensRemaining)
    : Math.max(0, tokenBalance.tokensIncluded - liveTokensUsed);

  if (fixerOpen && jobMeta?.jobId) {
    return (
      <SEOFixerPanel
        siteId={siteId}
        jobId={jobMeta.jobId}
        showTokenCost={showTokenCost}
        tokensRemaining={fixerTokensRemaining}
        connectionStatus={connectionStatus}
        cmsType={cmsType}
        queuedItems={findings.filter(f => checkedIds.has(f.id)).map(f => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          section: f.section,
          fixType: (f.automatedFix as { type?: string } | null)?.type,
          effort:  (f.automatedFix as { effort?: string } | null)?.effort,
        }))}
        onClose={() => setFixerOpen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background-default)" }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 py-3 border-b"
        style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}>
        <Link href={`/${locale}/dashboard/sites/${siteId}/cockpit`}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          aria-label="Back to cockpit">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: "oklch(from var(--category-seo) l c h / 0.12)", color: "var(--category-seo)" }}>
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h1 className="text-sm font-bold text-white">SEO GEO Analysis</h1>
          <span className="text-white/30 text-sm hidden sm:inline">—</span>
          <span className="text-sm text-white/60 truncate hidden sm:inline">{domain}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {streaming && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Analysing…
            </span>
          )}
          {done && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" /> {findings.length} findings
            </span>
          )}
          {jobMeta && (
            <span className="text-xs text-white/30 hidden sm:inline">{jobMeta.modelLabel}</span>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 pb-32">

        {/* Start button — shown when not yet started and autoStart is false */}
        {!autoStart && !hasStarted.current && !streaming && !done && !error && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <p className="text-white/50 text-sm">Ready to analyse <strong className="text-white">{domain}</strong></p>
            <button onClick={startStream}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "var(--category-seo)", boxShadow: "0 0 24px oklch(from var(--category-seo) l c h / 0.35)" }}>
              <Sparkles className="h-4 w-4" /> Start Analysis
            </button>
          </div>
        )}

        {/* Intro text */}
        {(streaming || done) && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {jobMeta?.userName ? `Hi ${jobMeta.userName},` : "Hi there,"}{" "}
              {streaming
                ? <span className="text-white/60">{AGENT_NAME} is analysing <span className="text-white">{domain}</span>…</span>
                : <span className="text-white/60">here's your SEO-GEO audit for <span className="text-white">{domain}</span></span>
              }
            </p>
            <p className="text-xs text-white/40 leading-relaxed max-w-xl">
              {streaming
                ? "Findings are appearing live as the AI analyses each section. Check issues you want to add to your repair queue."
                : "Review the findings below. Check each issue you want to fix, then launch Sparky to apply them automatically."}
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-400">
            {error} — <button onClick={() => { hasStarted.current = false; startStream(); }} className="underline">Retry</button>
          </div>
        )}

        {/* Master score hero */}
        {(streaming || done) && <MasterScoreHero score={masterScore} streaming={streaming} />}

        {/* 3 tabs */}
        {(streaming || done) && (
          <Tabs defaultValue="technical">
            <TabsList className="h-auto bg-transparent p-0 w-full justify-start rounded-none border-b border-white/8 gap-0">
              {TAB_GROUPS.map(group => {
                const tf = tabFindings(group.sections);
                const crit = tabCritCount(group.sections);
                const high = tabHighCount(group.sections);
                return (
                  <TabsTrigger key={group.id} value={group.id}
                    className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--category-seo)] data-[state=active]:bg-[oklch(from_var(--category-seo)_l_c_h_/_0.08)] bg-transparent text-white/50 data-[state=active]:text-white px-4 py-3 h-auto gap-1.5 text-sm transition-colors hover:text-white/80 hover:bg-white/4">
                    {group.label}
                    {tf.length > 0 && (
                      <span className="text-xs bg-white/10 rounded px-1.5 py-0.5 ml-1">{tf.length}</span>
                    )}
                    {crit > 0 && <span className="text-xs text-red-400">{crit} crit</span>}
                    {high > 0 && <span className="text-xs text-orange-400">{high} high</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {TAB_GROUPS.map(group => {
              const tf = tabFindings(group.sections);
              return (
                <TabsContent key={group.id} value={group.id} className="mt-5 space-y-6">
                  <BulkSelectBar findings={tf} checkedIds={checkedIds} onBulkToggle={handleBulkToggle} />
                  {group.sections.map(section => (
                    <SectionGroup key={section} section={section}
                      findings={findingsBySection[section]}
                      checkedIds={checkedIds} onToggle={toggleChecked} loading={streaming} />
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* llms.txt pinned card */}
        {(streaming || done) && (
          <LlmsTxtCard findings={findingsBySection[PINNED_SECTION]}
            checkedIds={checkedIds} onToggle={toggleChecked} loading={streaming} />
        )}
      </main>

      {/* ── Sticky footer ── */}
      {(streaming || done) && (
        <footer className="fixed bottom-0 left-0 right-0 z-20 border-t px-4 sm:px-6 py-3 space-y-2"
          style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}>
          <TokenUsageBar
            tokensUsed={liveTokensUsed}
            tokensTotal={tokenBalance.tokensIncluded}
            tokensConsumedThisAnalysis={totalTokensUsed}
            modelLabel={jobMeta?.modelLabel ?? "AI"}
            showCost={showTokenCost} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/40">
              {checkedCount > 0
                ? `${checkedCount} issue${checkedCount === 1 ? "" : "s"} selected for repair`
                : "Check issues above to add to repair queue"}
            </p>
            <button onClick={addToRepairQueue}
              disabled={checkedCount === 0 || queueSaving || !done}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                checkedCount > 0 && done ? "text-white" : "text-white/30 cursor-not-allowed")}
              style={checkedCount > 0 && done
                ? { background: "var(--category-seo)", boxShadow: "0 0 20px oklch(from var(--category-seo) l c h / 0.35)" }
                : { background: "var(--border-default)" }}>
              {queueSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Fix with {AGENT_NAME} (AI Agent)
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
