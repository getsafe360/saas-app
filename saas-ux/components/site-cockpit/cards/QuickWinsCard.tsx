// components/site-cockpit/cards/QuickWinsCard.tsx
"use client";

import { CockpitCard } from "./CockpitCard";
import { Zap, Clock, TrendingUp, ChevronRight, Sparkles } from "lucide-react";
import type { SiteCockpitResponse } from "@/types/site-cockpit";

interface QuickWinsCardProps {
  id: string;
  data: SiteCockpitResponse;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
}

const IMPACT_COLORS = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const EFFORT_COLORS = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
};

export function QuickWinsCard({
  id,
  data,
  minimized,
  onToggleMinimize,
  editable,
}: QuickWinsCardProps) {
  const { quickWins } = data;

  return (
    <CockpitCard
      id={id}
      title="Quick Wins"
      category="performance" // Use performance color theme
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
      className="lg:col-span-2" // Spans 2 columns on desktop
    >
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {quickWins.count}
            </div>
            <div className="text-xs text-gray-500">Opportunities</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {quickWins.potentialScoreIncrease}
            </div>
            <div className="text-xs text-gray-500">Score Boost</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {quickWins.estimatedTime}
            </div>
            <div className="text-xs text-gray-500">Est. Time</div>
          </div>
        </div>
      </div>

      {/* Quick Wins List */}
      <div className="space-y-3">
        {quickWins.items.map((item, index) => (
          <div
            key={item.id}
            className="group relative p-4 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
          >
            {/* Impact badge */}
            <div className="absolute top-4 right-4">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                  IMPACT_COLORS[item.impact]
                }`}
              >
                {item.impact.toUpperCase()}
              </span>
            </div>

            {/* Title & Issue */}
            <div className="pr-20 mb-3">
              <h4 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                {item.title}
              </h4>
              <p className="text-sm text-gray-400">{item.issue}</p>
            </div>

            {/* Score Impact */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Current:</span>
                <span className="text-sm font-semibold text-gray-300">
                  {item.currentScore}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-600" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Potential:</span>
                <span className="text-sm font-semibold text-green-400">
                  {item.potentialScore}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-sm font-bold text-green-400">
                  +{item.scoreIncrease}
                </span>
              </div>
            </div>

            {/* Fix Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Effort:</span>
                <span
                  className={`text-xs font-semibold ${
                    EFFORT_COLORS[item.effort]
                  }`}
                >
                  {item.effort.toUpperCase()}
                </span>
              </div>

              {/* One-Click Fix Badge */}
              {item.fix.oneClickAvailable && (
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-semibold transition-all duration-200 group-hover:scale-105">
                  <Zap className="h-3 w-3" />
                  One-Click Fix
                </button>
              )}
            </div>

            {/* Expandable fix details (optional - add state for expansion) */}
            {item.fix.code && (
              <div className="mt-3 p-3 rounded-lg bg-gray-900/60 border border-gray-700/30">
                <code className="text-xs text-green-400 font-mono">
                  {item.fix.code}
                </code>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div className="mt-6 text-center">
        <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
          Apply All Quick Wins ({quickWins.count})
        </button>
      </div>
    </CockpitCard>
  );
}
