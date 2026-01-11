// components/onboarding/QuickWinsPreview.tsx
"use client";

import { CheckCircle2, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

interface QuickWin {
  title: string;
  impact: "critical" | "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  scoreIncrease?: number;
}

interface QuickWinsPreviewProps {
  count: number;
  potentialScoreIncrease: number;
  currentScore?: number;
  items?: QuickWin[];
  maxItems?: number;
}

const impactColors = {
  critical: "text-red-600 bg-red-50 dark:bg-red-900/20",
  high: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  medium: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  low: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
};

const effortLabels = {
  low: "Quick fix",
  medium: "Moderate",
  high: "Complex",
};

/**
 * Preview of quick wins found during site analysis
 */
export function QuickWinsPreview({
  count,
  potentialScoreIncrease,
  currentScore,
  items = [],
  maxItems = 3,
}: QuickWinsPreviewProps) {
  const displayItems = items.slice(0, maxItems);
  const potentialScore = currentScore
    ? Math.min(100, currentScore + potentialScoreIncrease)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-600/10">
          <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {count} Quick Wins Found
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Fast improvements that could boost your score significantly
          </p>
        </div>
      </div>

      {/* Potential score increase */}
      {potentialScore && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-green-900 dark:text-green-100">
              Potential Score
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              {currentScore} → {potentialScore} (+{potentialScoreIncrease} points)
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{potentialScoreIncrease}
          </div>
        </div>
      )}

      {/* Quick wins list */}
      {displayItems.length > 0 && (
        <div className="space-y-2">
          {displayItems.map((item, index) => (
            <div
              key={index}
              className="group flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        impactColors[item.impact]
                      )}
                    >
                      {item.impact}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {effortLabels[item.effort]}
                    </span>
                  </div>
                </div>
                {item.scoreIncrease && (
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                    +{item.scoreIncrease} points
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show more indicator */}
      {count > maxItems && (
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          + {count - maxItems} more quick wins available in your cockpit
        </div>
      )}
    </div>
  );
}
