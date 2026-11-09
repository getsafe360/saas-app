// components/site-cockpit/cards/wordpress/components/Analysis/CoreFilesReview.tsx
"use client";

import { useState } from "react";
import { FileWarning, Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CoreFileReview, CoreVerdict } from "@/lib/wordpress/core-review";

interface CoreFilesReviewProps {
  siteId: string;
}

interface ReviewResponse {
  success: boolean;
  error?: string;
  aiUsed?: boolean;
  complete?: boolean;
  omitted?: number;
  unavailable?: number;
  files?: CoreFileReview[];
}

const VERDICT_STYLE: Record<CoreVerdict, string> = {
  malicious: "text-red-300 border-red-500/50",
  suspicious: "text-amber-300 border-amber-500/50",
  unclear: "text-neutral-300 border-neutral-500/50",
  customization: "text-sky-300 border-sky-500/50",
  harmless: "text-emerald-300 border-emerald-500/50",
};

const ERRORS = new Set(["RATE_LIMITED", "WORDPRESS_NOT_CONNECTED", "CORE_FILES_UNAVAILABLE"]);

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="mt-2 max-h-64 overflow-auto rounded-md border p-2 text-[11px] leading-relaxed" style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}>
      {diff.split("\n").map((line, index) => (
        <div
          key={index}
          className={
            line.startsWith("+") ? "text-emerald-300" : line.startsWith("-") ? "text-red-300" : line.startsWith("@@") ? "text-sky-300" : "text-neutral-400"
          }
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

/**
 * Explains changed WordPress core files with Claude, so the owner knows what
 * the checklist's restore and quarantine fixes would replace or remove.
 */
export function CoreFilesReview({ siteId }: CoreFilesReviewProps) {
  const t = useTranslations("SiteCockpit.wordpress.coreReview");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/wordpress/core-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const body = (await response.json().catch(() => null)) as ReviewResponse | null;
      if (!response.ok || !body?.success) {
        setError(body?.error && ERRORS.has(body.error) ? body.error : "GENERIC");
        return;
      }
      setResult(body);
    } catch {
      setError("GENERIC");
    } finally {
      setLoading(false);
    }
  };

  const files = result?.files ?? [];

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
      aria-labelledby="core-review-title"
    >
      <h5 id="core-review-title" className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <FileWarning className="h-4 w-4 text-red-300" />
        {t("title")}
      </h5>
      <p className="mb-1 text-xs" style={{ color: "var(--text-subtle)" }}>
        {t("description")}
      </p>
      <p className="mb-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>
        {t("privacy")}
      </p>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? t("running") : result ? t("rerun") : t("start")}
      </button>

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-red-500/40 p-2 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {!result.aiUsed && files.length > 0 && (
            <p className="text-xs text-amber-300">{t("aiUnavailable")}</p>
          )}
          {files.length === 0 && <p className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("empty")}</p>}

          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.path} className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all text-xs text-white">{file.path}</code>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[11px] ${VERDICT_STYLE[file.verdict]}`}>
                    {t(`verdict.${file.verdict}`)}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
                    {t(`kind.${file.kind}`)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-primary)" }}>{file.summary ?? t("notReviewed")}</p>
                {file.signals.length > 0 && (
                  <p className="mt-1 text-[11px] text-red-300">
                    {t("signals", { list: file.signals.map((signal) => t(`signal.${signal}`)).join(", ") })}
                  </p>
                )}
                <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-subtle)" }}>
                  {t(`recommendation.${file.recommendation}`)}
                </p>
                {!file.available ? (
                  <p className="mt-1 text-[11px] text-amber-300">{t("unavailable")}</p>
                ) : file.diff ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-sky-300">{t("showChanges")}</summary>
                    <DiffView diff={file.diff} />
                    {file.truncated && <p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("truncated")}</p>}
                  </details>
                ) : (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("noDiff")}</p>
                )}
              </li>
            ))}
          </ul>

          {(result.omitted ?? 0) > 0 && (
            <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("omitted", { count: result.omitted ?? 0 })}</p>
          )}
          {result.complete === false && (
            <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("incomplete")}</p>
          )}
          {files.length > 0 && <p className="text-xs" style={{ color: "var(--text-primary)" }}>{t("nextStep")}</p>}
        </div>
      )}
    </section>
  );
}
