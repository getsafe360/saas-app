// saas-ux/app/[locale]/(dashboard)/dashboard/sites/[id]/analyze/page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import MetricDonut from '@/components/report/MetricDonut';
import { CategorySection } from '@/components/report/CategorySection';
import { IssueCard } from '@/components/report/IssueCard';
export const experimental_ppr = true;

type StatusResp = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  costTokens?: number;
  reportBlobKey?: string;
  agentUsed?: string;
  errorMessage?: string;
  updatedAt?: string;
};

type Issue = {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'security';
  title: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  fixAvailable: boolean;
  estTokens: number;
};

type Report = {
  siteUrl: string;
  summary: { score: number; counts: Record<string, number>; estTotalTokens: number };
  issues: Issue[];
  pagesAnalyzed: string[];
};

type FixState = 'idle' | 'working' | 'done' | 'insufficient';

// simple heuristic to render a category "score" from issue severities
const severityWeight: Record<Issue['severity'], number> = { high: 30, medium: 15, low: 7 };
function categoryScore(issues: Issue[]) {
  const penalty = issues.reduce((acc, i) => acc + (severityWeight[i.severity] ?? 10), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export default function AnalyzePage() {
  const params = useParams(); // { locale, id }
  const siteId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-issue fix state
  const [fixing, setFixing] = useState<Record<string, FixState>>({});

  // Kick off a scan on first mount (only once)
  useEffect(() => {
    if (!siteId) return;
    (async () => {
      const r = await fetch('/api/scan/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId })
      });
      const j = await r.json();
      if (j.jobId) setJobId(j.jobId);
    })();
  }, [siteId]);

  // Poll status + fetch result when ready (handle 202 gracefully)
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
        const r = await fetch(`/api/scan/status?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (!r.ok) return; // soft fail, keep polling

        const j: StatusResp = await r.json();
        if (stopped) return;
        setStatus(j);

        if (j.status === 'error') {
          clear();
          return;
        }

        if (j.status === 'done') {
          const rr = await fetch(`/api/scan/result?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' });

          if (rr.status === 202) return; // not ready yet — let next tick retry
          if (!rr.ok) return; // soft fail

          const jr = await rr.json();
          if (stopped) return;

          setReport(jr.report);
          clear(); // only stop after we actually have the report
        }
      } catch {
        // swallow & retry next tick
      }
    };

    tick();
    polling.current = setInterval(tick, 2500);
    return clear;
  }, [jobId]);

  const busy = !status || status.status === 'queued' || status.status === 'running';

  // Group issues by category for pretty sections
  const grouped = (report?.issues ?? []).reduce(
    (acc, i) => {
      acc[i.category].push(i);
      return acc;
    },
    {
      seo: [] as Issue[],
      performance: [] as Issue[],
      accessibility: [] as Issue[],
      security: [] as Issue[]
    }
  );

  // ---- Fix flow ----
  async function startFix(issueId: string) {
    if (!siteId) return;
    // optimistically set working
    setFixing(s => ({ ...s, [issueId]: 'working' }));

    try {
      const r = await fetch('/api/fix/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteId, issueIds: [issueId] })
      });

      if (r.status === 422) {
        // insufficient tokens
        setFixing(s => ({ ...s, [issueId]: 'insufficient' }));
        return;
      }
      if (!r.ok) {
        // revert to idle on generic error
        setFixing(s => ({ ...s, [issueId]: 'idle' }));
        return;
      }

      const j = await r.json();
      const fixJobId: string | undefined = j.fixJobId;
      if (!fixJobId) {
        setFixing(s => ({ ...s, [issueId]: 'idle' }));
        return;
      }

      // short-lived poll for status
      const poll = async () => {
        try {
          const s = await fetch(`/api/fix/status?id=${encodeURIComponent(fixJobId)}`, { cache: 'no-store' });
          if (!s.ok) return setTimeout(poll, 1200);
          const js = await s.json();
          if (js.status !== 'done') return setTimeout(poll, 1200);

          // success ✓
          setFixing(prev => ({ ...prev, [issueId]: 'done' }));

          // optional: fetch result for audit/log (not required for UI)
          // const rr = await fetch(`/api/fix/result?id=${encodeURIComponent(fixJobId)}`, { cache: 'no-store' });
          // const rj = rr.ok ? await rr.json() : null;

          // optional: optimistically remove the issue from the list
          // or trigger a re-scan; for now we just mark as done.
        } catch {
          setTimeout(poll, 1200);
        }
      };
      poll();
    } catch {
      setFixing(s => ({ ...s, [issueId]: 'idle' }));
    }
  }

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

      {/* Status bar */}
      <div className="border rounded-xl p-4 flex items-center justify-between bg-white/60 dark:bg-slate-900/40 backdrop-blur">
        <div className="flex items-center gap-3">
          <StatusBadge status={(status?.status ?? 'queued') as any} />
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {busy ? 'Running analysis…' : status?.status === 'done' ? 'Complete' : 'Error'}
          </div>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {status?.agentUsed ? <>Agent: <span className="font-mono">{status.agentUsed}</span></> : null}
        </div>
      </div>

      {/* Skeleton */}
      {busy && (
        <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900/40">
          <div className="animate-pulse h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="animate-pulse h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1" />
          <div className="animate-pulse h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      )}

      {status?.status === 'error' && (
        <div className="rounded-xl border p-4 bg-rose-50 text-rose-800">
          ❌ Scan failed: {status.errorMessage || 'Unknown error'}
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-6">
          {/* Overall header */}
          <div className="rounded-3xl border p-6 bg-white/60 dark:bg-slate-900/40 backdrop-blur flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Overall</div>
              <div className="text-2xl font-semibold">{report.siteUrl}</div>
              <div className="text-sm text-slate-500 mt-1">
                Estimated tokens for available fixes:{' '}
                <span className="font-medium">~{report.summary.estTotalTokens.toLocaleString()} tokens</span>
              </div>
            </div>
            <MetricDonut value={report.summary.score} label="Score" />
          </div>

          {/* Categories grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <CategorySection
              title="SEO"
              score={categoryScore(grouped.seo)}
              accent="amber"
              issues={grouped.seo.map((i) => (
                <IssueCard
                  key={i.id}
                  {...i}
                  onFix={() => startFix(i.id)}
                  fixState={fixing[i.id] ?? 'idle'}
                />
              ))}
            />
            <CategorySection
              title="Performance"
              score={categoryScore(grouped.performance)}
              accent="sky"
              issues={grouped.performance.map((i) => (
                <IssueCard
                  key={i.id}
                  {...i}
                  onFix={() => startFix(i.id)}
                  fixState={fixing[i.id] ?? 'idle'}
                />
              ))}
            />
            <CategorySection
              title="Accessibility"
              score={categoryScore(grouped.accessibility)}
              accent="emerald"
              issues={grouped.accessibility.map((i) => (
                <IssueCard
                  key={i.id}
                  {...i}
                  onFix={() => startFix(i.id)}
                  fixState={fixing[i.id] ?? 'idle'}
                />
              ))}
            />
            <CategorySection
              title="Security"
              score={categoryScore(grouped.security)}
              accent="violet"
              issues={grouped.security.map((i) => (
                <IssueCard
                  key={i.id}
                  {...i}
                  onFix={() => startFix(i.id)}
                  fixState={fixing[i.id] ?? 'idle'}
                />
              ))}
            />
          </div>

          {/* Pages analyzed */}
          {report.pagesAnalyzed?.length > 0 && (
            <div className="rounded-2xl border p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur">
              <div className="font-semibold mb-2">Pages analyzed</div>
              <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                {report.pagesAnalyzed.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
