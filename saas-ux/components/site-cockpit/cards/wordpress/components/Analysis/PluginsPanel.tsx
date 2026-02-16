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
  const outdatedPlugins = plugins.list.filter(
    (p) => !p.vulnerable && p.version !== p.latest,
  );

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h5 className="text-sm font-semibold text-white flex items-center gap-2">
          <Package className="h-4 w-4" style={{ color: "var(--category-wordpress)" }} />
          Plugins
        </h5>
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {plugins.active}/{plugins.total} active
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBadge label="Outdated" value={plugins.outdated} />
        <StatBadge label="Vulnerable" value={plugins.vulnerable} />
        <StatBadge label="Healthy" value={Math.max(plugins.total - plugins.outdated, 0)} />
      </div>

      {vulnerablePlugins.length > 0 && (
        <div className="mb-3 space-y-2">
          {vulnerablePlugins.map((plugin) => (
            <div
              key={plugin.slug}
              className="rounded-lg border p-3"
              style={{
                borderColor: "oklch(from var(--color-danger) l c h / 0.35)",
                background: "oklch(from var(--color-danger) l c h / 0.1)",
              }}
            >
              <div className="text-sm font-semibold text-white">{plugin.name}</div>
              <div className="text-xs mt-1" style={{ color: "#fecaca" }}>
                {plugin.version} → {plugin.latest}
              </div>
              {plugin.vulnerabilities?.[0] && (
                <div className="text-xs mt-1" style={{ color: "#fda4af" }}>
                  {plugin.vulnerabilities[0].description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {outdatedPlugins.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: "oklch(from var(--color-warning) l c h / 0.35)",
            background: "oklch(from var(--color-warning) l c h / 0.1)",
          }}
        >
          <div className="text-xs" style={{ color: "#fde68a" }}>
            {outdatedPlugins.length} non-critical plugin(s) can be updated.
          </div>
        </div>
      )}
    </section>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border-default)" }}>
      <div className="text-[10px]" style={{ color: "var(--text-subtle)" }}>{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
