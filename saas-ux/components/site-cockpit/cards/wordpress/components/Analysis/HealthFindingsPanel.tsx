// components/site-cockpit/cards/wordpress/components/Analysis/HealthFindingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { WordPressHealthFinding } from "@/types/site-cockpit";

interface HealthFindingsPanelProps {
  findings: WordPressHealthFinding[];
  onOptimize?: (selected: WordPressHealthFinding[]) => Promise<void> | void;
  optimizing?: boolean;
}

const CATEGORY_LABEL: Record<WordPressHealthFinding["category"], string> = {
  security: "Security",
  performance: "Performance",
  stability: "Stability",
  "seo-ux": "SEO / UX",
  "red-flags": "Red Flags",
};

export function HealthFindingsPanel({ findings, onOptimize, optimizing }: HealthFindingsPanelProps) {
  const actionable = useMemo(
    () => findings.filter((f) => f.status === "fail" || f.status === "warning"),
    [findings],
  );

  const prechecked = useMemo(
    () => actionable.filter((f) => f.checkedByDefault),
    [actionable],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(prechecked.map((f) => f.id)));

  useEffect(() => {
    setSelectedIds(new Set(prechecked.map((f) => f.id)));
  }, [prechecked]);

  const selectedFindings = actionable.filter((finding) => selectedIds.has(finding.id));

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--category-wordpress)" }} />
          WP Health & Security AI Engine
        </h5>
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {selectedFindings.length} selected · {prechecked.length} critical fix(es) preselected
        </div>
      </div>

      <div className="space-y-2">
        {actionable.map((finding) => (
          <label
            key={finding.id}
            className="flex items-start gap-2 rounded-lg border p-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedIds.has(finding.id)}
              onChange={(event) => {
                const isChecked = event.currentTarget.checked;
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (isChecked) next.add(finding.id);
                  else next.delete(finding.id);
                  return next;
                });
              }}
              aria-label={`select-${finding.id}`}
            />
            <div className="flex-1">
              <div className="text-sm text-white flex items-center gap-1.5">
                {finding.category === "red-flags" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                ) : null}
                {finding.title}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                {CATEGORY_LABEL[finding.category]} · {finding.severity.toUpperCase()}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                {finding.action}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--text-subtle)" }}>
                Remediation: {finding.automationLevel ?? "manual"}
              </div>
            </div>
          </label>
        ))}
        {actionable.length === 0 && (
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            No actionable findings from current WordPress telemetry.
          </div>
        )}
      </div>

      {onOptimize && actionable.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--category-wordpress)" }}
            onClick={() => onOptimize(selectedFindings)}
            disabled={optimizing || selectedFindings.length === 0}
          >
            {optimizing ? "Optimizing..." : `Optimize (${selectedFindings.length})`}
          </button>
        </div>
      )}
    </section>
  );
}
