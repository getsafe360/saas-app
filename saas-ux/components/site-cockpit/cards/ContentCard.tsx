// components/site-cockpit/cards/ContentCard.tsx
import { CheckCircle, XCircle, FileText, TrendingUp } from "lucide-react";
import { CockpitCard } from "./CockpitCard";
import type { ContentData } from "@/types/site-cockpit";

interface ContentCardProps {
  data: ContentData;
  stats?: {
    passed: number;
    warnings: number;
    criticalIssues: number;
  };
  onOptimize?: () => void;
  optimizing?: boolean;
}

const QUALITY_LABELS: Record<ContentData["analysis"]["quality"], string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const QUALITY_COLORS: Record<ContentData["analysis"]["quality"], string> = {
  excellent: "text-green-400",
  good: "text-emerald-400",
  fair: "text-yellow-400",
  poor: "text-red-400",
};

export function ContentCard({
  data,
  stats,
  onOptimize,
  optimizing,
}: ContentCardProps) {
  return (
    <CockpitCard
      id="content"
      category="content"
      title="Content"
      score={data.score}
      grade={data.grade}
      stats={stats}
      onOptimize={onOptimize}
      optimizing={optimizing}
    >
      <div className="space-y-4">
        {/* Quality + Language row */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400 text-xs mb-0.5">Quality</div>
            <div
              className={`font-semibold ${QUALITY_COLORS[data.analysis.quality]}`}
            >
              {QUALITY_LABELS[data.analysis.quality]}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400 text-xs mb-0.5">Language</div>
            <div className={`font-medium uppercase ${!data.analysis.language ? "text-yellow-400" : ""}`}>
              {data.analysis.language ?? "—"}
            </div>
          </div>
        </div>

        {/* Title / Description length */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400 text-xs mb-0.5">Title length</div>
            <div
              className={`font-medium ${data.metadata.titleOptimal ? "text-green-400" : "text-yellow-400"}`}
            >
              {data.metadata.titleLength > 0
                ? `${data.metadata.titleLength} chars`
                : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400 text-xs mb-0.5">Desc. length</div>
            <div
              className={`font-medium ${data.metadata.descriptionOptimal ? "text-green-400" : "text-yellow-400"}`}
            >
              {data.metadata.descriptionLength > 0
                ? `${data.metadata.descriptionLength} chars`
                : "—"}
            </div>
          </div>
        </div>

        {/* Structure checks */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Title optimal (30–60 chars)
            </span>
            {data.metadata.titleOptimal ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Description optimal (120–160 chars)
            </span>
            {data.metadata.descriptionOptimal ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Single H1 heading
            </span>
            {data.structure.hasProperH1 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Issues / recommendations */}
        {data.recommendations.length > 0 && (
          <div className="pt-2 space-y-1">
            {data.recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <TrendingUp className="h-3 w-3 mt-0.5 shrink-0 text-orange-400" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CockpitCard>
  );
}
