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
    <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-gray-400 mb-1">WordPress Version</div>
          <div className="text-2xl font-bold text-white">{version.current}</div>
        </div>
        {version.outdated && (
          <div className="px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-semibold">
            Update Available
          </div>
        )}
      </div>

      {version.outdated && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-700/50">
          <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-gray-300 mb-1">
              {version.daysOld} days old • Latest: {version.latest}
            </div>
            <div className="text-xs text-gray-500">
              {recommendations.length} security recommendations
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap">
            Update Now
          </button>
        </div>
      )}
    </div>
  );
}
