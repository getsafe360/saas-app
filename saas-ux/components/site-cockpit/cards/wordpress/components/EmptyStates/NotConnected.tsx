// components/site-cockpit/cards/wordpress/components/EmptyStates/NotConnected.tsx
"use client";

import { Download, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import type { UseWordPressPairingReturn } from "../../types";
import { CURRENT_PLUGIN_VERSION } from "@/lib/wordpress/client";

interface NotConnectedProps {
  pairing: UseWordPressPairingReturn;
  version?: string;
  pluginVersion?: string;
}

function semverOutdated(installed: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [iMaj = 0, iMin = 0, iPat = 0] = parse(installed);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
  if (iMaj !== cMaj) return iMaj < cMaj;
  if (iMin !== cMin) return iMin < cMin;
  return iPat < cPat;
}

export function NotConnected({ version, pluginVersion }: NotConnectedProps) {
  const pluginInstalled = !!pluginVersion;
  const pluginOutdated = pluginInstalled && semverOutdated(pluginVersion, CURRENT_PLUGIN_VERSION);

  return (
    <div className="space-y-3">
      {/* WP version */}
      <div
        className="p-4 rounded-lg"
        style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
      >
        <div className="text-sm mb-1" style={{ color: "var(--text-subtle)" }}>WordPress Version</div>
        <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {version || "Unknown"}
        </div>
        <div className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
          Deep analysis available after connecting via the Site Connection card above.
        </div>
      </div>

      {/* Plugin install / update CTA */}
      {!pluginInstalled ? (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: "oklch(from var(--category-seo) l c h / 0.06)", border: "1px solid oklch(from var(--category-seo) l c h / 0.2)" }}
        >
          <div className="flex items-start gap-2.5">
            <Download className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--category-seo)" }} />
            <div>
              <p className="text-sm font-semibold text-white">Install GetSafe360 Connector</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                The free WordPress plugin enables automatic fix deployment, real-time health monitoring,
                and one-click optimizations from your dashboard.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://wordpress.org/plugins/getsafe360-connector"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: "var(--category-seo)" }}
            >
              <Download className="h-3 w-3" />
              Install from WordPress.org
            </a>
            <a
              href="https://docs.getsafe360.com/wordpress-plugin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border-default)", color: "var(--text-subtle)" }}
            >
              <ExternalLink className="h-3 w-3" />
              View install guide
            </a>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            Current version: <span className="font-mono">{CURRENT_PLUGIN_VERSION}</span>
          </p>
        </div>
      ) : pluginOutdated ? (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: "oklch(from var(--color-warning) l c h / 0.06)", border: "1px solid oklch(from var(--color-warning) l c h / 0.3)" }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-white">Plugin update available</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Installed: <span className="font-mono">{pluginVersion}</span> → Latest:{" "}
                <span className="font-mono">{CURRENT_PLUGIN_VERSION}</span>
              </p>
            </div>
          </div>
          <a
            href="https://wordpress.org/plugins/getsafe360-connector"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "oklch(from var(--color-warning) l c h / 0.2)", color: "#fbbf24", border: "1px solid oklch(from var(--color-warning) l c h / 0.3)" }}
          >
            <RefreshCw className="h-3 w-3" />
            Update plugin on WordPress.org
          </a>
        </div>
      ) : (
        <div
          className="rounded-lg p-3 flex items-center gap-2.5"
          style={{ background: "oklch(from var(--color-success) l c h / 0.06)", border: "1px solid oklch(from var(--color-success) l c h / 0.2)" }}
        >
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: "var(--color-success)" }} />
          <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Plugin v{pluginVersion} — up to date. Connect your site above to enable auto-fix deployment.
          </p>
        </div>
      )}
    </div>
  );
}
