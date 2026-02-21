// components/site-cockpit/cards/wordpress/components/Analysis/HealthFindingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WordPressHealthFinding } from "@/types/site-cockpit";
import {
  estimateSelectedSavingsMs,
  estimateSelectedScoreGain,
  recommendWordPressAnalysisDepth,
} from "../../utils/healthEngine";

interface HealthFindingsPanelProps {
  findings: WordPressHealthFinding[];
  onOptimize?: (
    selected: WordPressHealthFinding[],
    options?: { safeMode: boolean },
  ) => Promise<void> | void;
  optimizing?: boolean;
  currentScore?: number;
}

const CATEGORY_LABEL: Record<WordPressHealthFinding["category"], string> = {
  security: "security",
  performance: "performance",
  stability: "stability",
  "seo-ux": "seoUx",
  "red-flags": "redFlags",
};

export function HealthFindingsPanel({
  findings,
  onOptimize,
  optimizing,
  currentScore = 0,
}: HealthFindingsPanelProps) {
  const t = useTranslations("SiteCockpit.wordpress.findings");
  const actionable = useMemo(
    () => findings.filter((f) => f.status === "fail" || f.status === "warning"),
    [findings],
  );

  const prechecked = useMemo(
    () => actionable.filter((f) => f.checkedByDefault),
    [actionable],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(prechecked.map((f) => f.id)),
  );
  const [safeMode, setSafeMode] = useState(true);

  useEffect(() => {
    setSelectedIds(new Set(prechecked.map((f) => f.id)));
  }, [prechecked]);

  const selectedFindings = actionable.filter((finding) => selectedIds.has(finding.id));
  const safeFilteredSelected = safeMode
    ? selectedFindings.filter((finding) => finding.safetyLevel !== "sensitive")
    : selectedFindings;

  const projectedGain = estimateSelectedScoreGain(safeFilteredSelected);
  const projectedScore = Math.min(100, currentScore + projectedGain);
  const projectedSavingsMs = estimateSelectedSavingsMs(safeFilteredSelected);
  const recommendedDepth = recommendWordPressAnalysisDepth(actionable);

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--category-wordpress)" }} />
          {t("title")}
        </h5>
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {t("selectedSummary", {
            selected: safeFilteredSelected.length,
            preselected: prechecked.length,
          })}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
          <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("before")}</div>
          <div className="text-white font-semibold">{currentScore}</div>
        </div>
        <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
          <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("after")}</div>
          <div className="text-emerald-300 font-semibold">{projectedScore}</div>
        </div>
        <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
          <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("savings")}</div>
          <div className="text-blue-300 font-semibold">~{(projectedSavingsMs / 1000).toFixed(1)}s</div>
        </div>
      </div>

      <div className="mb-3 rounded-lg border p-3" style={{ borderColor: "var(--border-default)" }}>
        <div className="text-xs text-white flex items-center justify-between">
          <span>{t("safeMode")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={safeMode}
            onClick={() => setSafeMode((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${safeMode ? "bg-emerald-500" : "bg-neutral-600"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${safeMode ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>
          {safeMode ? t("safeModeDescriptionOn") : t("safeModeDescriptionOff")}
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>
          {t(`depth.${recommendedDepth}`)}
        </div>
      </div>

      <div className="space-y-2">
        {actionable.map((finding) => {
          const checked = selectedIds.has(finding.id);
          return (
            <div
              key={finding.id}
              className="flex items-start gap-2 rounded-lg border p-3"
              style={{ borderColor: "var(--border-default)" }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={`select-${finding.id}`}
                onClick={() => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(finding.id)) next.delete(finding.id);
                    else next.add(finding.id);
                    return next;
                  });
                }}
                className={`relative mt-0.5 inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-[var(--category-wordpress)]" : "bg-neutral-600"}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <div className="flex-1">
                <div className="text-sm text-white flex items-center gap-1.5">
                  {finding.category === "red-flags" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  ) : null}
                  {finding.title}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                  {t(`categories.${CATEGORY_LABEL[finding.category]}`)} · {finding.severity.toUpperCase()}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                  {finding.action}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>
                  {t("remediation")}: {finding.automationLevel ?? "manual"} · {t("impactGain", { gain: finding.estimatedScoreGain ?? 0 })}
                </div>
              </div>
            </div>
          );
        })}
        {actionable.length === 0 && (
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {t("noActionable")}
          </div>
        )}
      </div>

      {onOptimize && actionable.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--category-wordpress)" }}
            onClick={() => onOptimize(safeFilteredSelected, { safeMode })}
            disabled={optimizing || safeFilteredSelected.length === 0}
          >
            {optimizing
              ? t("optimizing")
              : t("fixSelected", { count: safeFilteredSelected.length })}
          </button>
        </div>
      )}
    </section>
  );
}
