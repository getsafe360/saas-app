// components/site-cockpit/cards/wordpress/components/Analysis/VersionStatus.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import type { WordPressRecommendation } from "@/types/site-cockpit";

interface VersionStatusProps {
  version: {
    current: string;
    latest: string;
    outdated: boolean;
    daysOld: number;
  };
  recommendations: WordPressRecommendation[];
}

export function VersionStatus({
  version,
  recommendations,
}: VersionStatusProps) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border-default)",
        background: "oklch(from var(--category-wordpress) l c h / 0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            WordPress Version
          </div>
          <div className="text-xl font-bold text-white mt-1">{version.current}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
            Latest: {version.latest}
          </div>
        </div>

        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold border"
          style={{
            color: version.outdated ? "#f59e0b" : "#10b981",
            borderColor: version.outdated
              ? "oklch(from var(--color-warning) l c h / 0.4)"
              : "oklch(from var(--color-success) l c h / 0.4)",
            background: version.outdated
              ? "oklch(from var(--color-warning) l c h / 0.15)"
              : "oklch(from var(--color-success) l c h / 0.15)",
          }}
        >
          {version.outdated ? "Update Available" : "Up to Date"}
        </span>
      </div>

      {version.outdated && (
        <div
          className="mt-3 rounded-lg border p-3 text-xs flex items-start gap-2"
          style={{
            borderColor: "oklch(from var(--color-warning) l c h / 0.35)",
            background: "oklch(from var(--color-warning) l c h / 0.1)",
            color: "#fde68a",
          }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {version.daysOld} days behind latest release · {recommendations.length} recommendation(s)
          </div>
        </div>
      )}
    </section>
  );
}
