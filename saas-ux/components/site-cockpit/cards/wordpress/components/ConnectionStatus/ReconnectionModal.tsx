// components/site-cockpit/cards/wordpress/components/ConnectionStatus/ReconnectionModal.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { X, RefreshCw, Copy, Check, Download } from "lucide-react";
import { WordPressAIIcon } from "@/components/icons/WordPressAI";
import type { ConnectionState, UseWordPressPairingReturn } from "../../types";

interface ReconnectionModalProps {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onClose: () => void;
  isReconnecting: boolean;
  siteUrl: string;
  pairing: UseWordPressPairingReturn;
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        connected ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" : "bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.12)]"
      }`}
    />
  );
}

export function ReconnectionModal({
  connectionState,
  onReconnect,
  onClose,
  isReconnecting,
  siteUrl,
  pairing,
}: ReconnectionModalProps) {
  const pairCodeGroups = useMemo(() => {
    if (!pairing.pairCode) return ["---", "---"];
    const sanitized = pairing.pairCode.replace(/\D/g, "").slice(0, 6);
    return [sanitized.slice(0, 3), sanitized.slice(3, 6)];
  }, [pairing.pairCode]);

  const pluginActive =
    pairing.pairingStatus === "waiting" ||
    pairing.pairingStatus === "connected" ||
    connectionState.status === "connected";

  const pairingAccepted =
    pairing.pairingStatus === "connected" || connectionState.status === "connected";

  const siteConnected = connectionState.status === "connected";

  useEffect(() => {
    if (pairing.pairingStatus !== "connected") return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [pairing.pairingStatus, onClose]);

  const handleGeneratePairCode = async () => {
    if (pairing.pairingStatus === "generating" || pairing.pairingStatus === "waiting") {
      return;
    }

    await pairing.startPairing();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-100">
              <WordPressAIIcon size={22} className="h-5 w-5" />
              WordPress Connection
            </h2>
            <p className="mt-1 text-sm text-slate-400">{siteUrl}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">How to connect your WP site to us</h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                1. Download, install &amp; activate our{" "}
                <a href="/wp-plugin/getsafe360-connector.zip" className="text-blue-300 underline underline-offset-4">
                  Plugin
                </a>
              </li>
              <li>2. Generate Pairing Code and copy</li>
              <li>3. Paste auth code into the plugin &amp; connect</li>
              <li>4. Come back to GetSafe 360 and you see your site connected</li>
            </ol>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-base font-semibold text-slate-100">Connection status</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Plugin (installed &amp; active)</span>
                  <StatusDot connected={pluginActive} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Pairing Code accepted</span>
                  <StatusDot connected={pairingAccepted} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Site conx</span>
                  <StatusDot connected={siteConnected} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Generate Pairing Code</h3>
                <p className="mt-1 text-sm text-slate-400">Copy the code into the plugin and connect.</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/wp-plugin/getsafe360-connector.zip"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" /> Download Plugin
                </a>
                <button
                  onClick={() => void handleGeneratePairCode()}
                  disabled={pairing.pairingStatus === "generating" || pairing.pairingStatus === "waiting"}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${pairing.pairingStatus === "generating" ? "animate-spin" : ""}`} />
                  {pairing.pairingStatus === "generating" ? "Generating..." : "Generate Pairing Code"}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">Pairing code</div>
              <div className="mt-3 flex items-center gap-3 text-3xl font-semibold text-slate-100">
                <span className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 tracking-[0.25em]">{pairCodeGroups[0]}</span>
                <span className="text-slate-500">-</span>
                <span className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 tracking-[0.25em]">{pairCodeGroups[1]}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => void pairing.copyToClipboard()}
                  disabled={!pairing.pairCode}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pairing.copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {pairing.copied ? "Copied" : "Copy code"}
                </button>
                <span className="text-xs text-slate-500">Single-use, expires in ~10 minutes.</span>
              </div>
            </div>

            {pairing.pairingStatus === "waiting" && (
              <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-950/30 p-3 text-sm text-blue-300">
                Waiting for plugin confirmation...
              </div>
            )}
            {pairing.pairingStatus === "connected" && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                Successfully Connected!
              </div>
            )}
            {pairing.pairingStatus === "error" && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
                {pairing.pairingMessage}
              </div>
            )}
            {connectionState.errorMessage && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
                {connectionState.errorMessage}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            Cancel
          </button>

          <button
            onClick={() => void onReconnect()}
            disabled={isReconnecting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isReconnecting ? "animate-spin" : ""}`} />
            {isReconnecting ? "Reconnecting..." : "Refresh Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
