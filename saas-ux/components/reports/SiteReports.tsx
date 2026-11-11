// components/reports/SiteReports.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, Download, Eye, FileText, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { REPORT_LOCALES, REPORT_PERIODS, type ReportFormat } from "@/lib/reports/options";

interface ReportRow {
  id: string;
  format: string;
  status: "pending" | "generating" | "completed" | "failed";
  filename: string | null;
  locale: string | null;
  periodDays: number | null;
  fixes: number | null;
  createdAt: string;
  downloadUrl: string | null;
}

interface SiteReportsProps {
  siteId: string;
  host: string;
  canReport: boolean;
  canWhiteLabel: boolean;
}

const ERRORS = new Set(["QUOTA_EXHAUSTED", "UPGRADE_REQUIRED", "RATE_LIMITED", "GENERIC"]);

const card = { background: "var(--header-bg)", borderColor: "var(--border-default)" } as const;

/** The site's Reports page: create a client report, preview it, download earlier ones. */
export function SiteReports({ siteId, host, canReport, canWhiteLabel }: SiteReportsProps) {
  const t = useTranslations("Reports.page");
  const uiLocale = useLocale();
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [language, setLanguage] = useState<string>((REPORT_LOCALES as ReadonlyArray<string>).includes(uiLocale) ? uiLocale : "en");
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const languageName = (code: string) => {
    try {
      const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return code;
    }
  };
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(uiLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/reports/${siteId}/generate`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.success) {
        setReports(body.reports as ReportRow[]);
        setQuota(body.quota);
      }
    } catch {
      /* the form still works; the list stays empty */
    }
  }, [siteId]);

  useEffect(() => {
    if (canReport) void load();
  }, [canReport, load]);

  const query = new URLSearchParams({ locale: language, periodDays: String(periodDays), whiteLabel: String(whiteLabel) });
  const previewUrl = `/api/reports/${siteId}/preview?${query}`;
  const exhausted = !!quota && quota.limit > 0 && quota.used >= quota.limit;

  const create = async () => {
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch(`/api/reports/${siteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, locale: language, periodDays, whiteLabel }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setError(typeof body?.error === "string" && ERRORS.has(body.error) ? body.error : "GENERIC");
        return;
      }
      setCreated(body.report.filename);
      if (body.quota) setQuota(body.quota);
      // Start the download right away; the report also stays in the list below.
      const link = document.createElement("a");
      link.href = body.report.downloadUrl;
      link.download = body.report.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      await load();
    } catch {
      setError("GENERIC");
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-xs font-semibold";
  const select =
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link
          href={`/dashboard/sites/${siteId}/cockpit`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs hover:underline"
          style={{ color: "var(--text-subtle)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          <FileText className="h-6 w-6" style={{ color: "var(--color-primary-400, #60a5fa)" }} />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-subtle)" }}>
          {t("description", { host })}
        </p>
      </div>

      {!canReport ? (
        <section className="rounded-2xl border p-6" style={card}>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            <Crown className="h-4 w-4 text-amber-400" />
            {t("upgradeTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-subtle)" }}>
            {t("upgradeText")}
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t("upgradeCta")}
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border p-5" style={card} aria-labelledby="new-report">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="new-report" className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("createTitle")}
              </h2>
              {quota && (
                <span className={`text-xs ${exhausted ? "text-amber-300" : ""}`} style={exhausted ? undefined : { color: "var(--text-subtle)" }}>
                  {quota.limit > 0 ? t("quota", { used: quota.used, limit: quota.limit }) : t("unlimited")}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <fieldset>
                <legend className={label} style={{ color: "var(--text-primary)" }}>{t("format")}</legend>
                <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--border-default)" }}>
                  {(["pdf", "markdown"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={format === value}
                      onClick={() => setFormat(value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${format === value ? "bg-blue-600 text-white" : ""}`}
                      style={format === value ? undefined : { color: "var(--text-subtle)" }}
                    >
                      {t(`formats.${value}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="report-language" className={label} style={{ color: "var(--text-primary)" }}>{t("language")}</label>
                <select
                  id="report-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className={select}
                  style={{ ...card, color: "var(--text-primary)" }}
                >
                  {REPORT_LOCALES.map((code) => (
                    <option key={code} value={code}>{languageName(code)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-period" className={label} style={{ color: "var(--text-primary)" }}>{t("period")}</label>
                <select
                  id="report-period"
                  value={periodDays}
                  onChange={(event) => setPeriodDays(Number(event.target.value))}
                  className={select}
                  style={{ ...card, color: "var(--text-primary)" }}
                >
                  {REPORT_PERIODS.map((days) => (
                    <option key={days} value={days}>{t(`periods.${days}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            {canWhiteLabel && (
              <label className="mt-4 flex items-start gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" checked={whiteLabel} onChange={(event) => setWhiteLabel(event.target.checked)} className="mt-1" />
                <span>
                  {t("whiteLabel")}
                  <span className="block text-xs" style={{ color: "var(--text-subtle)" }}>{t("whiteLabelHint")}</span>
                </span>
              </label>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={create}
                disabled={busy || exhausted}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {busy ? t("creating") : t("create")}
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-white/5"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              >
                <Eye className="h-4 w-4" />
                {t("preview")}
              </a>
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("previewHint")}</span>
            </div>

            {created && (
              <p role="status" className="mt-3 text-xs text-emerald-300">{t("created", { name: created })}</p>
            )}
            {(error || exhausted) && (
              <p role="alert" className="mt-3 rounded-md border border-red-500/40 p-2 text-xs text-red-300">
                {t(`errors.${error ?? "QUOTA_EXHAUSTED"}`)}
              </p>
            )}
          </section>

          <section className="rounded-2xl border p-5" style={card} aria-labelledby="earlier-reports">
            <h2 id="earlier-reports" className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("historyTitle")}
            </h2>
            {reports.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-subtle)" }}>{t("noHistory")}</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border-default)" }}>
                {reports.map((report) => (
                  <li key={report.id} className="flex flex-wrap items-center gap-3 py-2.5" style={{ borderColor: "var(--border-default)" }}>
                    <span
                      className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-subtle)" }}
                    >
                      {report.format === "markdown" ? "MD" : report.format.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm" style={{ color: "var(--text-primary)" }}>{report.filename ?? report.id}</div>
                      <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        {[
                          dateTime(report.createdAt),
                          report.locale ? languageName(report.locale) : null,
                          report.periodDays && (REPORT_PERIODS as ReadonlyArray<number>).includes(report.periodDays)
                            ? t(`periods.${report.periodDays}`)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {report.downloadUrl ? (
                      <a
                        href={report.downloadUrl}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-white/5"
                        style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("download")}
                      </a>
                    ) : (
                      <span className={`text-xs ${report.status === "failed" ? "text-red-300" : ""}`} style={report.status === "failed" ? undefined : { color: "var(--text-subtle)" }}>
                        {t(`status.${report.status === "failed" ? "failed" : "generating"}`)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
