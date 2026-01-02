// components/site-cockpit/cards/AccessibilityCard.tsx
import { CockpitCard } from "./CockpitCard";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { Accessibility } from "@/types/site-cockpit";

interface AccessibilityCardProps {
  data: Accessibility;
}

export function AccessibilityCard({ data }: AccessibilityCardProps) {
  return (
    <CockpitCard
      id="accessibility"
      category="accessibility"
      title="Accessibility"
      score={data.score}
    >
      <div className="space-y-4">
        {/* WCAG Level */}
        {data.wcagLevel && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              WCAG Level
            </span>
            <span className="text-sm font-medium">{data.wcagLevel}</span>
          </div>
        )}

        {/* Issues Summary */}
        {(data as any).issues !== undefined && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Issues Found
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Total Issues
              </span>
              <span
                className={`text-sm font-medium ${
                  ((data as any).issues?.length ?? 0) === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {(data as any).issues?.length ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* Passed Checks */}
        {(data as any).passedChecks !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Passed Checks
            </span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {(data as any).passedChecks}
            </span>
          </div>
        )}

        {/* Categories */}
        {(data as any).categories &&
          Object.keys((data as any).categories).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                By Category
              </h4>
              <div className="space-y-2">
                {Object.entries((data as any).categories).map(
                  ([category, count]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {category}
                      </span>
                      <span className="text-sm font-medium">
                        {String(count)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {/* Issues List */}
        {(data as any).issues && (data as any).issues.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Top Issues
            </h4>
            <ul className="space-y-1">
              {(data as any).issues
                .slice(0, 3)
                .map((issue: any, idx: number) => (
                  <li
                    key={idx}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </CockpitCard>
  );
}
