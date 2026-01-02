// components/site-cockpit/cards/PerformanceCard.tsx
import { CockpitCard } from "./CockpitCard";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Performance } from "@/types/site-cockpit";

interface PerformanceCardProps {
  data: Performance;
}

export function PerformanceCard({ data }: PerformanceCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  // use a local, safely-typed variable for recommendations because Performance may not declare it
  const recommendations = (data as any).recommendations as string[] | undefined;

  return (
    <CockpitCard
      id="performance"
      category="performance"
      title="Performance"
      score={data.score}
    >
      <div className="space-y-4">
        {/* Metrics */}
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

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
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
