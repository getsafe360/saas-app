// app/[locale]/(dashboard)/dashboard/sites/[id]/analyze/AnalyzeClient.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import MetricDonut from "@/components/report/MetricDonut";
import { CategorySection } from "@/components/report/CategorySection";
import { IssueCard } from "@/components/report/IssueCard";
import {
  FixProposalPanel,
  type ProposedOperation,
  type RejectedItem,
} from "@/components/report/FixProposalPanel";

type StatusResp = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  reportBlobKey?: string;
  agentUsed?: string;
  errorMessage?: string | null;
  updatedAt?: string;
};

type Category = "seo" | "performance" | "accessibility" | "security";

type Issue = {
  id: string;
  category: Category;
  title: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
  fixAvailable: boolean;
  estTokens: number;
  evidence?: string;
};

type Report = {
  siteUrl: string;
  generatedAt?: string;
  summary: {
    score: number;
    counts: Record<string, number>;
    /** Added by the real scanner; older reports may not have it. */
    categoryScores?: Record<Category, number>;
    estTotalTokens: number;
    prose?: string;
  };
  issues: Issue[];
  pagesAnalyzed: string[];
  coverage?: { pageSpeed: boolean; prose: boolean; cms: string };
};

type FixState =
  | "idle"
  | "working"
  | "review"
  | "applying"
  | "applied"
  | "insufficient"
  | "failed";

type Proposal = {
  fixJobId: string;
  operations: ProposedOperation[];
  rejected: RejectedItem[];
  estTokens: number;
};

const CATEGORY_LABELS: Array<{ key: Category; title: string; accent: string }> = [
  { key: "seo", title: "SEO", accent: "amber" },
  { key: "performance", title: "Performance", accent: "sky" },
  { key: "accessibility", title: "Accessibility", accent: "emerald" },
  { key: "security", title: "Security", accent: "violet" },
];

// Fallback for reports written before the scanner emitted per-category scores.
const severityWeight: Record<Issue["severity"], number> = { high: 22, medium: 11, low: 4 };
function derivedScore(issues: Issue[]) {
  const penalty = issues.reduce((acc, i) => acc + (severityWeight[i.severity] ?? 10), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export default function AnalyzeClient() {
  const params = useParams();
  const siteId = Array.isArray((params as any).id)
    ? (params as any).id[0]
    : (params as any).id;
  const locale = typeof (params as any).locale === "string" ? (params as any).locale : "en";

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(0);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tokens, setTokens] = useState<number | null>(null);
  const [fixing, setFixing] = useState<Record<string, FixState>>({});
  const [fixError, setFixError] = useState<Record<string, string>>({});
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});

  const refreshTokens = useCallback(async () => {
    const r = await fetch("/api/team/tokens", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (typeof j.tokensRemaining === "number") setTokens(j.tokensRemaining);
  }, []);

  useEffect(() => {
    void refreshTokens();
  }, [refreshTokens]);

  // Kick off a scan on mount, and again when the user retries.
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;

    (async () => {
      setStartError(null);
      setReport(null);
      setStatus(null);
      try {
        const r = await fetch("/api/scan/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ siteId, locale }),
        });
        const j = await r.json().catch(() => null);
        if (cancelled) return;

        if (!r.ok || !j?.jobId) {
          setStartError(
            r.status === 429
              ? "You have run a lot of scans recently. Please wait a few minutes and try again."
              : j?.message ?? j?.error ?? "We could not start the scan. Please try again."
          );
          return;
        }
        setJobId(j.jobId);
      } catch {
        if (!cancelled) setStartError("We could not reach the server. Check your connection and try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [siteId, locale, runToken]);

  // Poll status, then fetch the report once the job is done.
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;

    const clear = () => {
      if (polling.current) clearInterval(polling.current);
      polling.current = null;
      stopped = true;
    };

    const tick = async () => {
      try {
        const r = await fetch(`/api/scan/status?id=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        if (!r.ok) return;

        const j: StatusResp = await r.json();
        if (stopped) return;
        setStatus(j);

        if (j.status === "error") {
          clear();
          return;
        }

        if (j.status === "done") {
          const rr = await fetch(`/api/scan/result?id=${encodeURIComponent(jobId)}`, {
            cache: "no-store",
          });
          if (rr.status === 202) return;
          if (!rr.ok) return;

          const jr = await rr.json();
          if (stopped) return;
          setReport(jr.report);
          clear();
        }
      } catch {
        /* swallow and retry on the next tick */
      }
    };

    void tick();
    polling.current = setInterval(tick, 2500);
    return clear;
  }, [jobId]);

  const busy = !startError && (!status || status.status === "queued" || status.status === "running");

  const grouped = (report?.issues ?? []).reduce(
    (acc, i) => {
      (acc[i.category] ??= []).push(i);
      return acc;
    },
    {} as Record<Category, Issue[]>
  );

  // ── Fix flow ──────────────────────────────────────────────────────────────
  // Step 1 prepares a proposal (no site changes, no charge). Step 2 applies it.

  async function prepareFix(issue: Issue) {
    if (!siteId) return;
    setFixError((s) => ({ ...s, [issue.id]: "" }));
    setFixing((s) => ({ ...s, [issue.id]: "working" }));

    try {
      const r = await fetch("/api/fix/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, issueIds: [issue.id], locale }),
      });
      const j = await r.json().catch(() => null);

      if (!r.ok) {
        if (j?.error === "insufficient_tokens") {
          setFixing((s) => ({ ...s, [issue.id]: "insufficient" }));
          return;
        }
        setFixing((s) => ({ ...s, [issue.id]: "failed" }));
        setFixError((s) => ({
          ...s,
          [issue.id]:
            j?.message ??
            (j?.error === "not_connected"
              ? "Connect the GetSafe 360 plugin to this site before applying fixes."
              : j?.error === "no_recent_scan"
                ? "Run a scan first, then try the fix again."
                : "We could not prepare this fix. Please try again."),
        }));
        return;
      }

      setProposals((s) => ({
        ...s,
        [issue.id]: {
          fixJobId: j.fixJobId,
          operations: j.operations ?? [],
          rejected: j.rejected ?? [],
          estTokens: j.estTokens ?? 0,
        },
      }));
      setFixing((s) => ({ ...s, [issue.id]: "review" }));
    } catch {
      setFixing((s) => ({ ...s, [issue.id]: "failed" }));
      setFixError((s) => ({ ...s, [issue.id]: "We could not reach the server. Please try again." }));
    }
  }

  async function applyFix(issue: Issue) {
    const proposal = proposals[issue.id];
    if (!proposal) return;

    setFixing((s) => ({ ...s, [issue.id]: "applying" }));
    setFixError((s) => ({ ...s, [issue.id]: "" }));

    try {
      const r = await fetch("/api/fix/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: proposal.fixJobId }),
      });
      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setFixing((s) => ({ ...s, [issue.id]: "failed" }));
        setFixError((s) => ({
          ...s,
          [issue.id]: j?.message ?? "We could not apply the change. You were not charged.",
        }));
        return;
      }

      if (typeof j.remainingTokens === "number") setTokens(j.remainingTokens);
      setFixing((s) => ({ ...s, [issue.id]: "applied" }));
    } catch {
      setFixing((s) => ({ ...s, [issue.id]: "failed" }));
      setFixError((s) => ({ ...s, [issue.id]: "We could not reach the server. Nothing was charged." }));
    }
  }

  async function discardFix(issue: Issue) {
    const proposal = proposals[issue.id];
    if (!proposal) return;
    await fetch("/api/fix/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: proposal.fixJobId }),
    }).catch(() => {});
    setProposals((s) => {
      const next = { ...s };
      delete next[issue.id];
      return next;
    });
    setFixing((s) => ({ ...s, [issue.id]: "idle" }));
    void refreshTokens();
  }

  function renderIssue(i: Issue) {
    const state = fixing[i.id] ?? "idle";
    const proposal = proposals[i.id];

    return (
      <div key={i.id} className="space-y-2">
        <IssueCard {...i} onFix={() => prepareFix(i)} fixState={state} />

        {fixError[i.id] && state !== "review" && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
            {fixError[i.id]}
          </div>
        )}

        {state === "insufficient" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            You do not have enough tokens for this fix.{" "}
            <Link href={`/${locale}/plans`} className="underline font-medium">
              Add tokens
            </Link>
          </div>
        )}

        {proposal && (state === "review" || state === "applying" || state === "applied" || state === "failed") && (
          <FixProposalPanel
            operations={proposal.operations}
            rejected={proposal.rejected}
            estTokens={proposal.estTokens}
            state={state === "failed" ? "failed" : (state as "review" | "applying" | "applied")}
            error={fixError[i.id] || null}
            onApply={() => applyFix(i)}
            onCancel={() => discardFix(i)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Full Scan</h1>
          <p className="text-slate-500 text-sm">
            We&apos;ll analyze SEO, Performance, Accessibility, and Security.
          </p>
        </div>
        <Link
          href={`/dashboard/sites/${siteId}`}
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back to site
        </Link>
      </div>

      {/* Status bar */}
      <div className="border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 bg-white/60 dark:bg-slate-900/40 backdrop-blur">
        <div className="flex items-center gap-3">
          <StatusBadge status={(startError ? "error" : status?.status ?? "queued") as any} />
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {startError
              ? "Could not start"
              : busy
                ? "Running analysis…"
                : status?.status === "done"
                  ? "Complete"
                  : "Error"}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <span className="rounded-md border px-2 py-1 bg-white/70 dark:bg-slate-900/40">
            Tokens: <span className="font-semibold">{tokens ?? "—"}</span>
          </span>
        </div>
      </div>

      {/* Failure states — both "could not start" and "scan errored" are
          actionable, so both offer a retry rather than a dead end. */}
      {(startError || status?.status === "error") && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-rose-800 dark:text-rose-200 text-sm">
            {startError ?? status?.errorMessage ?? "The scan could not be completed."}
          </div>
          <button
            type="button"
            onClick={() => {
              setJobId(null);
              setRunToken((n) => n + 1);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-300 bg-white/70 text-sm font-medium text-rose-800 hover:bg-white"
          >
            <RotateCw className="w-4 h-4" /> Retry scan
          </button>
        </div>
      )}

      {report && (
        <div className="border rounded-xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Analysis complete</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              View your site&apos;s health dashboard with detailed insights and quick wins.
            </p>
          </div>
          <Link
            href={`/dashboard/sites/${siteId}/cockpit`}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            Open Cockpit
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {busy && (
        <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900/40">
          <div className="animate-pulse h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="animate-pulse h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1" />
          <div className="animate-pulse h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="rounded-3xl border p-6 bg-white/60 dark:bg-slate-900/40 backdrop-blur flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm text-slate-500">Overall</div>
              <div className="text-2xl font-semibold break-all">{report.siteUrl}</div>
              {report.summary.prose && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 max-w-2xl whitespace-pre-line">
                  {report.summary.prose}
                </p>
              )}
              <div className="text-sm text-slate-500 mt-3">
                Estimated tokens for available fixes:{" "}
                <span className="font-medium">
                  ~{report.summary.estTotalTokens.toLocaleString()} tokens
                </span>
              </div>
              {report.coverage && !report.coverage.pageSpeed && (
                <div className="text-xs text-slate-500 mt-2">
                  Lighthouse metrics were unavailable for this run; scores come from our own
                  checks.
                </div>
              )}
            </div>
            <MetricDonut value={report.summary.score} label="Score" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {CATEGORY_LABELS.map(({ key, title, accent }) => {
              const issues = grouped[key] ?? [];
              return (
                <CategorySection
                  key={key}
                  title={title}
                  score={report.summary.categoryScores?.[key] ?? derivedScore(issues)}
                  accent={accent as any}
                  issues={
                    issues.length > 0
                      ? issues.map(renderIssue)
                      : [
                          <p key="none" className="text-sm text-slate-500">
                            No issues found in this category.
                          </p>,
                        ]
                  }
                />
              );
            })}
          </div>

          {report.pagesAnalyzed?.length > 0 && (
            <div className="rounded-2xl border p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur">
              <div className="font-semibold mb-2">Pages analyzed</div>
              <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                {report.pagesAnalyzed.map((p) => (
                  <li key={p} className="break-all">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
