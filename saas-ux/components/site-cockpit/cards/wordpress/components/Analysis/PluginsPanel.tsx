// components/site-cockpit/cards/wordpress/components/Analysis/PluginsPanel.tsx
"use client";

import { Package } from "lucide-react";

interface Plugin {
  slug: string;
  name: string;
  version: string;
  latest: string;
  vulnerable: boolean;
  vulnerabilities?: Array<{
    description: string;
  }>;
}

interface PluginsData {
  total: number;
  active: number;
  outdated: number;
  vulnerable: number;
  list: Plugin[];
}

interface PluginsPanelProps {
  plugins: PluginsData;
}

export function PluginsPanel({ plugins }: PluginsPanelProps) {
  const vulnerablePlugins = plugins.list.filter((p) => p.vulnerable);
  const hasOutdatedNonVulnerable = plugins.outdated > plugins.vulnerable;

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold text-white flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-400" />
          Plugins ({plugins.total})
        </h4>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">{plugins.active} active</span>
          {plugins.outdated > 0 && (
            <span className="text-orange-400">{plugins.outdated} outdated</span>
          )}
          {plugins.vulnerable > 0 && (
            <span className="text-red-400 font-semibold">
              {plugins.vulnerable} vulnerable
            </span>
          )}
        </div>
      </div>

      {/* Vulnerable Plugins */}
      {vulnerablePlugins.length > 0 && (
        <div className="space-y-2 mb-4">
          {vulnerablePlugins.map((plugin) => (
            <div
              key={plugin.slug}
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {plugin.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    Current: {plugin.version} → Update to: {plugin.latest}
                  </div>
                </div>
                <button className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors">
                  Fix Now
                </button>
              </div>
              {plugin.vulnerabilities && plugin.vulnerabilities.length > 0 && (
                <div className="text-xs text-red-400">
                  {plugin.vulnerabilities[0].description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Outdated Plugins (non-vulnerable) */}
      {hasOutdatedNonVulnerable && (
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-orange-400">
              {plugins.outdated - plugins.vulnerable} plugins need updates
            </div>
            <button className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
              View All →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
