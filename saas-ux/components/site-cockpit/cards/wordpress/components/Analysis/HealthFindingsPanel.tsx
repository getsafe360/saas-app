// components/site-cockpit/cards/wordpress/components/Analysis/HealthFindingsPanel.tsx
"use client";

import { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { WordPressHealthFinding } from "@/types/site-cockpit";

interface HealthFindingsPanelProps {
  findings: WordPressHealthFinding[];
}

const CATEGORY_LABEL: Record<WordPressHealthFinding["category"], string> = {
  security: "Security",
  performance: "Performance",
  stability: "Stability",
  "seo-ux": "SEO / UX",
  "red-flags": "Red Flags",
};

export function HealthFindingsPanel({ findings }: HealthFindingsPanelProps) {
  const actionable = useMemo(
    () => findings.filter((f) => f.status === "fail" || f.status === "warning"),
    [findings],
  );

  const prechecked = useMemo(
    () => actionable.filter((f) => f.checkedByDefault),
    [actionable],
  );

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
          {prechecked.length} critical fix(es) preselected
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
              defaultChecked={finding.checkedByDefault}
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
            </div>
          </label>
        ))}
        {actionable.length === 0 && (
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            No actionable findings from current WordPress telemetry.
          </div>
        )}
      </div>
    </section>
  );
}
