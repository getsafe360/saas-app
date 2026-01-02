// components/site-cockpit/cards/wordpress/components/EmptyStates/NotConnected.tsx
"use client";

import { Link as LinkIcon, ExternalLink, CheckCircle } from "lucide-react";
import type { UseWordPressPairingReturn } from "../../types";
import { PairingModal } from "../ConnectionStatus/PairingModal";

interface NotConnectedProps {
  pairing: UseWordPressPairingReturn;
  version?: string;
}

export function NotConnected({ pairing, version }: NotConnectedProps) {
  return (
    <>
      {!pairing.showPairingFlow ? (
        // Initial Connect CTA
        <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <LinkIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Connect Your WordPress Site
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Generate a 6-digit pairing code and enter it in the GetSafe 360
                plugin to unlock deep insights and security analysis.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => pairing.setShowPairingFlow(true)}
                  disabled={pairing.pairingStatus === "generating"}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <LinkIcon className="h-4 w-4" />
                  {pairing.pairingStatus === "generating"
                    ? "Generating..."
                    : "Generate Pairing Code"}
                </button>
                <a
                  href="/wp-plugin/getsafe360-connector.zip"
                  download
                  className="px-4 py-2 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Download Plugin
                </a>
              </div>
            </div>
          </div>

          {/* What You'll Get */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <div className="font-medium">Plugin & Theme Analysis</div>
                <div className="text-xs text-gray-500">
                  Detect outdated & vulnerable plugins
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <div className="font-medium">Security Scanning</div>
                <div className="text-xs text-gray-500">
                  Check login exposure & XML-RPC
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <div className="font-medium">Performance Metrics</div>
                <div className="text-xs text-gray-500">
                  Object cache & OPcache status
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Show Pairing Modal
        <PairingModal
          pairCode={pairing.pairCode}
          pairingStatus={pairing.pairingStatus}
          pairingMessage={pairing.pairingMessage}
          copied={pairing.copied}
          onCopy={pairing.copyToClipboard}
          onClose={() => pairing.setShowPairingFlow(false)}
        />
      )}

      {/* Basic WP Info */}
      <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
        <div className="text-sm text-gray-400 mb-1">WordPress Version</div>
        <div className="text-lg font-semibold text-white">
          {version || "Unknown"}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {pairing.showPairingFlow
            ? "Waiting for plugin connection..."
            : "Connect for comprehensive analysis"}
        </div>
      </div>
    </>
  );
}
