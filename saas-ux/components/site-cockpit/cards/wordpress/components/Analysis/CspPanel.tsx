// components/site-cockpit/cards/wordpress/components/Analysis/CspPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface CspPanelProps {
  siteId: string;
  /** Bumped after Undo elsewhere, so a stopped test disappears. */
  refreshKey?: number;
  onStarted?: () => void;
}

interface Violation {
  directive: string;
  blocked: string;
  count: number;
  page: string | null;
}

interface Status {
  state: { policy: string; startedAt: string } | null;
  violations: Violation[];
  totalReports: number;
}

interface Preview {
  policy: string;
  directives: Record<string, string[]>;
  pages: string[];
  connectorReady: boolean;
}

const ERRORS = new Set(["RATE_LIMITED", "SITE_UNREACHABLE", "CONNECTOR_UPDATE", "CONNECTOR_UNREACHABLE", "CONNECTOR_FAILED", "WORDPRESS_NOT_CONNECTED"]);

function errorKey(code: unknown): string {
  return typeof code === "string" && ERRORS.has(code) ? code : "GENERIC";
}

/**
 * Content-Security-Policy builder: proposes a policy from what the site loads,
 * tests it in report-only mode and shows what browsers would have blocked.
 */
export function CspPanel({ siteId, refreshKey = 0, onStarted }: CspPanelProps) {
  const t = useTranslations("SiteCockpit.wordpress.csp");
  const locale = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "start" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/csp`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.success) setStatus(body as Status);
    } catch {
      /* the panel still offers to build a policy */
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const call = async (kind: "preview" | "start") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/csp/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "start" && preview ? { policy: preview.policy } : {}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setError(errorKey(body?.error));
        return;
      }
      if (kind === "preview") {
        setPreview(body as Preview);
      } else {
        setPreview(null);
        onStarted?.();
        await load();
      }
    } catch {
      setError("GENERIC");
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy("refresh");
    await load();
    setBusy(null);
  };

  const testing = status?.state ?? null;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  const days = testing ? Math.max(0, Math.floor((Date.now() - new Date(testing.startedAt).getTime()) / 86_400_000)) : 0;

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
      aria-labelledby="csp-panel-title"
    >
      <h5 id="csp-panel-title" className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--category-security)" }} />
        {t("title")}
      </h5>

      {!testing && (
        <>
          <p className="mb-3 text-xs" style={{ color: "var(--text-subtle)" }}>
            {t("description")}
          </p>
          {!preview && (
            <button
              type="button"
              onClick={() => call("preview")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === "preview" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {busy === "preview" ? t("building") : t("build")}
            </button>
          )}
        </>
      )}

      {preview && !testing && (
        <div className="mt-2 space-y-3">
          <p className="text-xs" style={{ color: "var(--text-primary)" }}>
            {t("scanned", { count: preview.pages.length })}
          </p>
          <ul className="space-y-1.5">
            {Object.entries(preview.directives)
              .filter(([directive]) => directive !== "report-uri")
              .map(([directive, sources]) => (
                <li key={directive} className="text-[11px]">
                  <code style={{ color: "var(--text-primary)" }}>{directive}</code>{" "}
                  <span className="break-all" style={{ color: "var(--text-subtle)" }}>
                    {sources.join(" ")}
                  </span>
                </li>
              ))}
          </ul>
          {(preview.directives["script-src"] ?? []).includes("'unsafe-inline'") && (
            <p className="text-[11px] text-amber-300">{t("inlineNote")}</p>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {t("reportOnlyNote")}
          </p>
          {!preview.connectorReady && <p className="text-xs text-amber-300">{t("errors.CONNECTOR_UPDATE")}</p>}
          <button
            type="button"
            onClick={() => call("start")}
            disabled={busy !== null || !preview.connectorReady}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy === "start" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("start")}
          </button>
        </div>
      )}

      {testing && (
        <div className="mt-1 space-y-3">
          <p className="text-xs" style={{ color: "var(--text-primary)" }}>
            {t("testingSince", { date: date(testing.startedAt), days })}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
              {t("reports", { count: status?.totalReports ?? 0 })}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
              style={{ borderColor: "var(--border-default)", color: "var(--text-subtle)" }}
            >
              <RefreshCw className={`h-3 w-3 ${busy === "refresh" ? "animate-spin" : ""}`} />
              {t("refresh")}
            </button>
          </div>

          {(status?.violations.length ?? 0) === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
              {t("noReports")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead style={{ color: "var(--text-subtle)" }}>
                  <tr>
                    <th className="py-1 pr-3 font-medium">{t("columns.directive")}</th>
                    <th className="py-1 pr-3 font-medium">{t("columns.source")}</th>
                    <th className="py-1 pr-3 text-right font-medium">{t("columns.count")}</th>
                    <th className="py-1 font-medium">{t("columns.page")}</th>
                  </tr>
                </thead>
                <tbody style={{ color: "var(--text-primary)" }}>
                  {status!.violations.map((violation) => (
                    <tr key={`${violation.directive} ${violation.blocked}`} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                      <td className="py-1 pr-3"><code>{violation.directive}</code></td>
                      <td className="break-all py-1 pr-3"><code>{violation.blocked}</code></td>
                      <td className="py-1 pr-3 text-right">{violation.count}</td>
                      <td className="break-all py-1"><code>{violation.page ?? "—"}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {t("testingHint")}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-red-500/40 p-2 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}
    </section>
  );
}
