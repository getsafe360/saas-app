"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";

type StatusResp = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  costTokens?: number;
  reportBlobKey?: string;
  agentUsed?: string;
  errorMessage?: string;
  updatedAt?: string;
};

type Report = {
  siteUrl: string;
  summary: { score: number; counts: Record<string, number>; estTotalTokens: number };
  issues: {
    id: string;
    category: "seo" | "performance" | "accessibility" | "security";
    title: string;
    severity: "low" | "medium" | "high";
    description: string;
    suggestion: string;
    fixAvailable: boolean;
    estTokens: number;
  }[];
  pagesAnalyzed: string[];
};

export default function AnalyzePage({ params }: { params: { id: string } }) {
  const siteId = params.id;
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kick off a scan on first mount (only once)
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const j = await r.json();
      if (j.jobId) setJobId(j.jobId);
    })();
  }, [siteId]);

  // Poll status; if queued, server will execute the scan in that call
  useEffect(() => {
    if (!jobId) return;
    const tick = async () => {
      const r = await fetch(`/api/scan/status?id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const j: StatusResp = await r.json();
      setStatus(j);
      if (j.status === "done") {
        clear();
        const rr = await fetch(`/api/scan/result?id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const jr = await rr.json();
        setReport(jr.report);
      } else if (j.status === "error") {
        clear();
      }
    };
    const clear = () => {
      if (polling.current) clearInterval(polling.current);
      polling.current = null;
    };
    tick();
    polling.current = setInterval(tick, 2500);
    return clear;
  }, [jobId]);

  const busy = !status || status.status === "queued" || status.status === "running";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Full Scan</h1>
          <p className="text-slate-500 text-sm">We’ll analyze SEO, Performance, Accessibility, and Security.</p>
        </div>
        <Link href={`/dashboard/sites/${siteId}`} className="text-sm text-slate-600 hover:underline">
          ← Back to site
        </Link>
      </div>

      <div className="border rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={status?.status ?? "pending"} />
          <div className="text-sm text-slate-600">
            {busy ? "Running analysis…" : status?.status === "done" ? "Complete" : "Error"}
          </div>
        </div>
        <div className="text-sm text-slate-600">
          {status?.agentUsed ? <>Agent: <span className="font-mono">{status.agentUsed}</span></> : null}
        </div>
      </div>

      {busy && (
        <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/40">
          <div className="animate-pulse h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="animate-pulse h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1" />
          <div className="animate-pulse h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      )}

      {status?.status === "error" && (
        <div className="rounded-lg border p-4 bg-rose-50 text-rose-800">
          ❌ Scan failed: {status.errorMessage || "Unknown error"}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid md:grid-cols-4 gap-4">
            <SummaryCard label="Overall" value={`${report.summary.score}/100`} />
            <SummaryCard label="SEO" value={String(report.summary.counts.seo ?? 0)} />
            <SummaryCard label="Performance" value={String(report.summary.counts.performance ?? 0)} />
            <SummaryCard label="Accessibility" value={String(report.summary.counts.accessibility ?? 0)} />
          </div>

          {/* Issues */}
          <div className="space-y-3">
            {report.issues.map((i) => (
              <div key={i.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{i.title}</div>
                  <span className="text-xs uppercase tracking-wide opacity-70">{i.category}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{i.description}</p>
                <p className="text-sm text-slate-500 mt-1"><span className="font-medium">Suggestion:</span> {i.suggestion}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="opacity-70">Severity: {i.severity}</span>
                  <div className="flex items-center gap-2">
                    {i.fixAvailable ? (
                      <button
                        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={() => alert(`Would start fix for ${i.id} (est ${i.estTokens} tokens)`)}>
                        Fix • ~{i.estTokens} tokens
                      </button>
                    ) : (
                      <span className="opacity-60">No one-click fix</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost footer */}
          <div className="border rounded-lg p-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Estimated total tokens to apply available fixes.
            </div>
            <div className="text-lg font-semibold">
              ~{report.summary.estTotalTokens.toLocaleString()} tokens
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white/60 dark:bg-slate-900/50">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
