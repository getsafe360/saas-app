// components/site-cockpit/cards/PerformanceCard.tsx
import { CockpitCard } from "./CockpitCard";
import type { Performance } from "@/types/site-cockpit";

interface PerformanceCardProps {
  data: Performance;
  stats?: {
    passed: number;
    warnings: number;
    criticalIssues: number;
  };
  onOptimize?: () => void;
  optimizing?: boolean;
}

export function PerformanceCard({
  data,
  stats,
  onOptimize,
  optimizing,
}: PerformanceCardProps) {
  const recommendations = (data as any).recommendations as string[] | undefined;

  return (
    <CockpitCard
      id="performance"
      category="performance"
      title="Performance"
      score={data.score}
      grade={data.grade}
      stats={stats}
      onOptimize={onOptimize}
      optimizing={optimizing}
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Core Metrics
          </h4>
          <div className="space-y-2">
            {data.metrics &&
              Object.entries(data.metrics).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <span className="text-sm font-medium">
                    {typeof value === "number" ? `${value}ms` : value}
                  </span>
                </div>
              ))}
          </div>

          {recommendations && recommendations.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 mt-3">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-1">
                {recommendations.slice(0, 3).map((rec, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                  >
                    <span className="text-sky-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </CockpitCard>
  );
}
