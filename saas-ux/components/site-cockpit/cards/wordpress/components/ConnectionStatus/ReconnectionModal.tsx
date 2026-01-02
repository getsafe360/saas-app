// components/site-cockpit/cards/wordpress/components/ConnectionStatus/ReconnectionModal.tsx
"use client";

import React, { useState } from "react";
import {
  XCircle,
  Package,
  Wifi,
  RefreshCw,
  CheckCircle,
  PlayCircle,
  AlertCircle,
} from "lucide-react";
import type { ConnectionState } from "../../types";

interface ReconnectionModalProps {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onClose: () => void;
  isReconnecting: boolean;
  siteUrl: string;
}

export function ReconnectionModal({
  connectionState,
  onReconnect,
  onClose,
  isReconnecting,
  siteUrl,
}: ReconnectionModalProps) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      id: 1,
      title: "Check Plugin Status",
      description: "Ensure GetSafe 360 Connector is active",
      action: "Verify Plugin",
      icon: Package,
    },
    {
      id: 2,
      title: "Test Connection",
      description: "Attempting to reach your WordPress site",
      action: "Test Now",
      icon: Wifi,
    },
    {
      id: 3,
      title: "Sync Data",
      description: "Retrieving latest site information",
      action: "Sync",
      icon: RefreshCw,
    },
  ];

  const handleStepAction = async (stepId: number) => {
    setStep(stepId);

    if (stepId === 3) {
      // Final step - trigger reconnection
      await onReconnect();
      setTimeout(() => onClose(), 2000);
    } else {
      // Auto-advance to next step
      setTimeout(() => setStep(stepId + 1), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Reconnect WordPress Site
            </h2>
            <p className="text-sm text-gray-400">{siteUrl}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <XCircle className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center flex-1">
                <div
                  className={`flex flex-col items-center ${
                    index < steps.length - 1 ? "w-full" : ""
                  }`}
                >
                  <div
                    className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all ${
                      step >= s.id
                        ? "bg-blue-500 border-blue-500"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    <s.icon
                      className={`h-6 w-6 ${
                        step >= s.id ? "text-white" : "text-gray-500"
                      } ${step === s.id ? "animate-pulse" : ""}`}
                    />
                  </div>
                  <div className="mt-2 text-xs text-center">
                    <div
                      className={`font-semibold ${
                        step >= s.id ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {s.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      step > s.id ? "bg-blue-500" : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step Details */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              {React.createElement(steps[step - 1].icon, {
                className: "h-6 w-6 text-blue-400",
              })}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                {steps[step - 1].title}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {steps[step - 1].description}
              </p>

              {/* Step-specific content */}
              {step === 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">
                      Plugin installed and active
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">API key configured</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-gray-300">
                      Pinging WordPress REST API...
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono bg-gray-900 p-2 rounded">
                    GET {siteUrl}/wp-json/getsafe360/v1/status
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  {isReconnecting ? (
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                      <span className="text-gray-300">
                        Syncing site data...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">
                        Connection restored!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {step < 3 && (
              <button
                onClick={() => handleStepAction(step)}
                disabled={isReconnecting}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2"
              >
                {steps[step - 1].action}
                <PlayCircle className="h-4 w-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => handleStepAction(3)}
                disabled={isReconnecting}
                className={`px-6 py-2 rounded-lg ${
                  isReconnecting
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-500 text-white"
                } font-semibold transition-colors flex items-center gap-2`}
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {connectionState.errorMessage && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-400 mb-1">
                  Connection Error
                </div>
                <div className="text-xs text-gray-400">
                  {connectionState.errorMessage}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
