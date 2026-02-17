// components/site-cockpit/cards/wordpress/components/ConnectionStatus/ReconnectionModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Package,
  Wifi,
  RefreshCw,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import type { ConnectionState, UseWordPressPairingReturn } from "../../types";

interface ReconnectionModalProps {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onClose: () => void;
  isReconnecting: boolean;
  siteUrl: string;
  pairing: UseWordPressPairingReturn;
}

type ModalView = "reconnect" | "pair";

export function ReconnectionModal({
  connectionState,
  onReconnect,
  onClose,
  isReconnecting,
  siteUrl,
  pairing,
}: ReconnectionModalProps) {
  const [step, setStep] = useState(1);
  const [view, setView] = useState<ModalView>("reconnect");

  const steps = [
    {
      id: 1,
      title: "Check Plugin",
      description: "Confirm GetSafe 360 Connector is active",
      action: "Verify Plugin",
      icon: Package,
    },
    {
      id: 2,
      title: "Test Connection",
      description: "Ping your WordPress connector endpoint",
      action: "Test Now",
      icon: Wifi,
    },
    {
      id: 3,
      title: "Sync Data",
      description: "Pull latest status from your site",
      action: "Sync",
      icon: RefreshCw,
    },
  ];

  const pairCodeGroups = useMemo(() => {
    if (!pairing.pairCode) return ["---", "---"];
    const sanitized = pairing.pairCode.replace(/\D/g, "").slice(0, 6);
    return [sanitized.slice(0, 3), sanitized.slice(3, 6)];
  }, [pairing.pairCode]);

  const handleStepAction = async (stepId: number) => {
    setStep(stepId);

    if (stepId === 3) {
      await onReconnect();
      return;
    }

    setTimeout(() => setStep(stepId + 1), 1200);
  };

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
            <h2 className="text-2xl font-semibold text-slate-100">WordPress Connection</h2>
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

        <div className="px-6 pt-5">
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
            <button
              onClick={() => setView("reconnect")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                view === "reconnect"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Reconnect
            </button>
            <button
              onClick={() => setView("pair")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                view === "pair"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Pair with Code
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
          {view === "reconnect" ? (
            <>
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-5 flex items-center justify-between">
                  {steps.map((s, index) => (
                    <div key={s.id} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                            step >= s.id
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-700 bg-slate-900 text-slate-500"
                          }`}
                        >
                          <s.icon className={`h-4 w-4 ${step === s.id ? "animate-pulse" : ""}`} />
                        </div>
                        <span className="mt-2 text-center text-xs text-slate-300">{s.title}</span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`mx-2 h-px flex-1 ${step > s.id ? "bg-blue-500" : "bg-slate-700"}`} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
                  <h3 className="text-base font-semibold text-slate-100">{steps[step - 1].title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{steps[step - 1].description}</p>

                  {step === 2 && (
                    <div className="mt-3 rounded-md border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-400">
                      GET {siteUrl}/wp-json/getsafe360/v1/status
                    </div>
                  )}

                  {step === 3 && !isReconnecting && !connectionState.errorMessage && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Connection restored.
                    </div>
                  )}
                </div>

                {connectionState.errorMessage && (
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <AlertCircle className="h-4 w-4" /> Connection Error
                    </div>
                    {connectionState.errorMessage}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-base font-semibold text-slate-100">Prefer a fresh pairing?</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Generate a new 6-digit code and pair the plugin again to recover from auth mismatch or stale keys.
                </p>
                <button
                  onClick={() => {
                    setView("pair");
                    void handleGeneratePairCode();
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <Link2 className="h-4 w-4" /> Generate Pairing Code
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">Generate Pairing Code</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      GetSafe 360 Connector: copy the 6-digit code, paste it in the plugin, then click Connect.
                    </p>
                  </div>
                  <button
                    onClick={() => void handleGeneratePairCode()}
                    disabled={pairing.pairingStatus === "generating" || pairing.pairingStatus === "waiting"}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${pairing.pairingStatus === "generating" ? "animate-spin" : ""}`} />
                    {pairing.pairingStatus === "generating" ? "Generating..." : "Generate Pairing Code"}
                  </button>
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

                <ol className="mt-5 space-y-2 text-sm text-slate-300">
                  <li>1. Open WordPress Admin → <span className="font-medium text-slate-100">GetSafe 360 Connector</span>.</li>
                  <li>2. Paste the code shown above into the plugin pairing field.</li>
                  <li>3. Click <span className="font-medium text-slate-100">Connect</span> in the plugin.</li>
                  <li>4. Keep this modal open while we confirm the connection.</li>
                </ol>

                {pairing.pairingStatus === "waiting" && (
                  <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-950/30 p-3 text-sm text-blue-300">
                    Waiting for plugin confirmation...
                  </div>
                )}
                {pairing.pairingStatus === "connected" && (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-300">
                    Your site is now connected and can scan and optimize your WordPress.
                  </div>
                )}
                {pairing.pairingStatus === "error" && (
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
                    {pairing.pairingMessage}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            Cancel
          </button>

          {view === "reconnect" && (
            <button
              onClick={() => void handleStepAction(step)}
              disabled={isReconnecting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isReconnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {step === 3 ? (isReconnecting ? "Reconnecting..." : "Complete") : steps[step - 1].action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
