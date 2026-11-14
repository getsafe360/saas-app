// components/site-cockpit/cards/seo/SeoGeoChecks.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, MinusCircle, RefreshCw, Search, Sparkles, XCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { CheckStatus, Finding } from "@/lib/engine/contracts";
import type { SeoGeoReport } from "@/lib/engine/seo/report";
import { isGeoFinding } from "@/lib/engine/seo/rules";

interface ScorePoint {
  checkedAt: string;
  geo: number | null;
  seo: number | null;
}

const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, unknown: 2, pass: 3, "not-applicable": 4 };
const ERRORS = new Set(["RATE_LIMITED", "SITE_UNREACHABLE", "CRAWL_FAILED"]);

function StatusIcon({ status }: { status: CheckStatus }) {
  const cls = "mt-0.5 h-4 w-4 flex-shrink-0";
  if (status === "pass") return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (status === "warn") return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (status === "fail") return <XCircle className={`${cls} text-red-400`} />;
  if (status === "unknown") return <CircleHelp className={`${cls}`} style={{ color: "var(--text-subtle)" }} />;
  return <MinusCircle className={cls} style={{ color: "var(--text-subtle)" }} />;
}

function scoreColor(score: number | null) {
  if (score === null) return "var(--text-subtle)";
  if (score >= 80) return "oklch(0.75 0.17 163.28)";
  if (score >= 50) return "oklch(0.78 0.17 83.66)";
  return "oklch(0.63 0.24 29.23)";
}

/**
 * Measured SEO and GEO checks: what robots.txt, llms.txt, the sitemap and up to
 * ten pages actually show. No AI involved; unknown inputs are shown as unknown.
 */
export function SeoGeoChecks({ siteId }: { siteId: string }) {
  const t = useTranslations("SiteCockpit.seoGeo");
  const tFindings = useTranslations("Findings");
  const format = useFormatter();
  const [report, setReport] = useState<SeoGeoReport | null>(null);
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassed, setShowPassed] = useState(false);

  const text = useCallback(
    (key: string | undefined, fallback: string, values?: Record<string, string | number>) => {
      if (!key || !tFindings.has(key)) return fallback;
      try {
        return tFindings(key, values);
      } catch {
        return fallback;
      }
    },
    [tFindings],
  );

  const apply = (body: { report?: SeoGeoReport | null; history?: ScorePoint[] }) => {
    setReport(body.report ?? null);
    setHistory(Array.isArray(body.history) ? body.history : []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sites/${siteId}/seo-geo`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.success) apply(body);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/seo-geo`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setError(typeof body?.error === "string" && ERRORS.has(body.error) ? body.error : "GENERIC");
        return;
      }
      apply(body);
    } catch {
      setError("GENERIC");
    } finally {
      setRunning(false);
    }
  };

  const groups = useMemo(() => {
    const sorted = [...(report?.findings ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    return {
      geo: sorted.filter((finding) => isGeoFinding(finding.id)),
      seo: sorted.filter((finding) => !isGeoFinding(finding.id)),
    };
  }, [report]);

  // The previous run, for "+n since last check".
  const previous = history.find((point) => report && point.checkedAt !== report.checkedAt) ?? null;

  const scoreTile = (label: string, score: number | null, before: number | null | undefined) => {
    const delta = score !== null && typeof before === "number" ? score - before : null;
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
          {label}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: scoreColor(score) }}>
            {score ?? "—"}
          </span>
          {delta !== null && delta !== 0 && (
            <span className={`text-xs font-semibold ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {t("delta", { delta: delta > 0 ? `+${delta}` : String(delta) })}
            </span>
          )}
        </div>
      </div>
    );
  };

  const row = (finding: Finding) => {
    const problem = finding.status === "fail" || finding.status === "warn";
    return (
      <li key={finding.id} className="flex items-start gap-2.5 py-2.5">
        <StatusIcon status={finding.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {text(finding.messages?.title, finding.title)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
              {t(`status.${finding.status === "not-applicable" ? "na" : finding.status}`)}
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-subtle)" }}>
            {text(finding.messages?.summary, finding.summary, finding.messages?.values)}
          </p>
          {finding.evidence?.observed && (
            <p className="mt-1 break-all font-mono text-[11px]" style={{ color: "var(--text-subtle)" }}>
              {t("found")} {finding.evidence.observed}
            </p>
          )}
          {problem && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-primary)" }}>
              → {text(finding.messages?.recommendation, finding.recommendation)}
            </p>
          )}
        </div>
      </li>
    );
  };

  const section = (title: string, icon: React.ReactNode, findings: Finding[]) => {
    const visible = showPassed ? findings : findings.filter((f) => f.status !== "pass" && f.status !== "not-applicable");
    const hidden = findings.length - visible.length;
    return (
      <section className="rounded-xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}>
        <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {icon}
          {title}
        </h3>
        {visible.length > 0 ? (
          <ul className="mt-1 divide-y" style={{ borderColor: "var(--border-default)" }}>
            {visible.map(row)}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-emerald-400">{t("allPassed")}</p>
        )}
        {hidden > 0 && (
          <button type="button" onClick={() => setShowPassed(true)} className="gs-link mt-2 text-xs" style={{ color: "var(--text-subtle)" }}>
            {t("showPassed", { count: hidden })}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4" id="seo-geo-checks">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-subtle)" }}>
            {t("subtitle")}
          </p>
          {report && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              {t("checked", {
                date: format.dateTime(new Date(report.checkedAt), { dateStyle: "medium", timeStyle: "short" }),
                count: report.pagesScanned,
              })}
              {report.pageErrors > 0 && ` · ${t("pageErrors", { count: report.pageErrors })}`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running || loading}
          className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {running ? t("running") : report ? t("rerun") : t("run")}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("loading")}
        </div>
      ) : !report ? (
        <p className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-subtle)" }}>
          {t("empty")}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {scoreTile(t("geoTitle"), report.scores.geo, previous?.geo)}
            {scoreTile(t("seoTitle"), report.scores.seo, previous?.seo)}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {section(t("geoTitle"), <Sparkles className="h-4 w-4" style={{ color: "var(--category-seo)" }} />, groups.geo)}
            {section(t("seoTitle"), <Search className="h-4 w-4" style={{ color: "var(--category-seo)" }} />, groups.seo)}
          </div>
          {showPassed && (
            <button type="button" onClick={() => setShowPassed(false)} className="gs-link text-xs" style={{ color: "var(--text-subtle)" }}>
              {t("hidePassed")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
