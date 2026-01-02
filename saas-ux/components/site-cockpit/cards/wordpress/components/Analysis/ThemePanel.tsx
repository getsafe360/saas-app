// components/site-cockpit/cards/wordpress/components/Analysis/ThemePanel.tsx
"use client";

import { Palette } from "lucide-react";

interface ThemeData {
  active: string;
  version: string;
  latest: string;
  outdated: boolean;
}

interface ThemePanelProps {
  theme: ThemeData;
}

export function ThemePanel({ theme }: ThemePanelProps) {
  return (
    <div className="mb-6 p-4 rounded-xl bg-gray-800/40 border border-gray-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Palette className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {theme.active}
            </div>
            <div className="text-xs text-gray-400">
              v{theme.version}
              {theme.outdated && ` • Update to ${theme.latest}`}
            </div>
          </div>
        </div>
        {theme.outdated && (
          <button className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
            Update Theme
          </button>
        )}
      </div>
    </div>
  );
}
