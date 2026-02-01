// components/site-cockpit/cards/optimization/components/Summary/BeforeAfterComparison.tsx
"use client";

import { TrendingDown, ArrowRight, Zap } from "lucide-react";
import type { BeforeAfterComparisonProps } from "../../types";
import { formatBytes } from "../../utils/calculations";

export function BeforeAfterComparison({
  comparison,
  animated = true,
}: BeforeAfterComparisonProps) {
  const { before, potential } = comparison;

  // Safe percentage calculation (avoid division by zero / NaN)
  const safePercent = (beforeVal: number, afterVal: number) =>
    beforeVal > 0 ? ((beforeVal - afterVal) / beforeVal) * 100 : 0;

  const improvements = {
    pageWeight: safePercent(before.pageWeight, potential.pageWeight),
    requests: safePercent(before.requests, potential.requests),
    loadTime: safePercent(before.loadTime, potential.loadTime),
    score: potential.score - before.score,
  };

  return (
    <div className="mb-6">
      {/* Score Improvement Header */}
      <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">Performance Score</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-red-400">
                  {before.grade}
                </span>
                <span className="text-xl text-gray-500">({before.score})</span>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-500" />
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-green-400">
                  {potential.grade}
                </span>
                <span className="text-xl text-gray-300">
                  ({potential.score})
                </span>
              </div>
            </div>
          </div>
          {improvements.score > 0 && (
            <div className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-400" />
                <span className="text-lg font-bold text-green-400">
                  +{improvements.score} points
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Page Weight */}
        <MetricCard
          label="Page Weight"
          before={formatBytes(before.pageWeight)}
          after={formatBytes(potential.pageWeight)}
          improvement={improvements.pageWeight}
          icon="📦"
          animated={animated}
        />

        {/* Requests */}
        <MetricCard
          label="HTTP Requests"
          before={before.requests.toString()}
          after={potential.requests.toString()}
          improvement={improvements.requests}
          icon="🔄"
          animated={animated}
        />

        {/* Load Time */}
        <MetricCard
          label="Load Time"
          before={`${before.loadTime.toFixed(1)}s`}
          after={`${potential.loadTime.toFixed(1)}s`}
          improvement={improvements.loadTime}
          icon="⚡"
          animated={animated}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  before: string;
  after: string;
  improvement: number;
  icon: string;
  animated: boolean;
}

function MetricCard({
  label,
  before,
  after,
  improvement,
  icon,
  animated,
}: MetricCardProps) {
  return (
    <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>

      {/* Before → After */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Before</div>
          <div className="text-lg font-semibold text-red-400">{before}</div>
        </div>

        <ArrowRight className="h-4 w-4 text-gray-600 flex-shrink-0" />

        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">After</div>
          <div className="text-lg font-semibold text-green-400">{after}</div>
        </div>
      </div>

      {/* Improvement Badge */}
      {improvement > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
          <TrendingDown className="h-3 w-3 text-green-400" />
          <span className="text-xs font-semibold text-green-400">
            {improvement.toFixed(0)}% reduction
          </span>
        </div>
      )}
    </div>
  );
}
