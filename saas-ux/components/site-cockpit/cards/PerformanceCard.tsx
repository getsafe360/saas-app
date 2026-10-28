// components/site-cockpit/cards/PerformanceCard.tsx
import { CockpitCard } from "./CockpitCard";
import type { Performance } from "@/types/site-cockpit";

interface PerformanceCardProps {
  data: Performance;
  stats?: {
    passed: number;
    warnings: number;
    criticalIssues: number;
    topIssues?: string[];
  };
  onOptimize?: () => void;
  advisory?: boolean;
  onUnlock?: () => void;
  optimizing?: boolean;
}

export function PerformanceCard({
  data,
  stats,
  onOptimize,
  optimizing,
  advisory,
  onUnlock,
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
      advisory={advisory}
      onUnlock={onUnlock}
    >
      <div className="space-y-4">
        <div>
          {data.facts ? (
            <>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Page makeup
              </h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-slate-700/40 p-2">
                  <div className="text-slate-400 text-xs mb-0.5">Scripts</div>
                  <div className={`font-medium ${data.facts.heavyScripts ? "text-yellow-400" : ""}`}>
                    {data.facts.scripts}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-700/40 p-2">
                  <div className="text-slate-400 text-xs mb-0.5">Images</div>
                  <div className={`font-medium ${data.facts.heavyImages ? "text-yellow-400" : ""}`}>
                    {data.facts.images}
                  </div>
                </div>
                {data.facts.htmlKb !== null && (
                  <div className="rounded-lg border border-slate-700/40 p-2">
                    <div className="text-slate-400 text-xs mb-0.5">HTML size</div>
                    <div className="font-medium">{data.facts.htmlKb} KB</div>
                  </div>
                )}
              </div>
            </>
          ) : null}

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
