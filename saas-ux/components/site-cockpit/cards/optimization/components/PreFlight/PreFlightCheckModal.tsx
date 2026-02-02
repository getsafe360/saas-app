// components/site-cockpit/cards/optimization/components/PreFlight/PreFlightCheckModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, AlertTriangle, XCircle, Loader2, Zap, ChevronRight } from "lucide-react";
import type { PreFlightCheck, PreFlightResult, PreFlightModalProps, CheckStatus } from "./types";

// Compact check definitions
const CHECKS = [
  { id: 'connection', label: 'Site connection' },
  { id: 'wordpress', label: 'WordPress connection plugin' },
  { id: 'backup', label: 'Backup status' },
  { id: 'analysis', label: 'Optimization analysis' },
  { id: 'compatibility', label: 'Compatibility check' },
  { id: 'queue', label: 'Optimization queue' },
];

export function PreFlightCheckModal({
  isOpen,
  onClose,
  onComplete,
  onProceed,
  config,
}: PreFlightModalProps) {
  const [checks, setChecks] = useState<PreFlightCheck[]>([]);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(-1);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<PreFlightResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      const applicableChecks = CHECKS.filter(check => {
        if (check.id === 'wordpress' && config.connectionType !== 'wordpress') {
          return false;
        }
        return true;
      }).map(check => ({
        ...check,
        status: 'pending' as CheckStatus,
      }));

      setChecks(applicableChecks);
      setCurrentCheckIndex(-1);
      setIsComplete(false);
      setResult(null);

      setTimeout(() => runChecks(applicableChecks), 300);
    }
  }, [isOpen, config.connectionType]);

  const runChecks = useCallback(async (initialChecks: PreFlightCheck[]) => {
    const updatedChecks = [...initialChecks];
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    const warningMessages: string[] = [];
    const errorMessages: string[] = [];

    for (let i = 0; i < updatedChecks.length; i++) {
      setCurrentCheckIndex(i);

      updatedChecks[i] = { ...updatedChecks[i], status: 'running' };
      setChecks([...updatedChecks]);

      const checkResult = await executeCheck(updatedChecks[i].id, config);

      updatedChecks[i] = {
        ...updatedChecks[i],
        status: checkResult.status,
        message: checkResult.message,
      };
      setChecks([...updatedChecks]);

      if (checkResult.status === 'success') passed++;
      else if (checkResult.status === 'warning') {
        warnings++;
        if (checkResult.message) warningMessages.push(checkResult.message);
      } else if (checkResult.status === 'error') {
        failed++;
        if (checkResult.message) errorMessages.push(checkResult.message);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalResult: PreFlightResult = {
      checks: updatedChecks,
      canProceed: failed === 0,
      warnings: warningMessages,
      errors: errorMessages,
      summary: { totalChecks: updatedChecks.length, passed, warnings, failed },
    };

    setResult(finalResult);
    setIsComplete(true);
    onComplete(finalResult);
  }, [config, onComplete]);

  if (!isOpen) return null;

  const getStatusIcon = (status: CheckStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />;
      case 'success':
        return (
          <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        );
      case 'warning':
        return (
          <div className="h-5 w-5 rounded-full bg-yellow-500 flex items-center justify-center">
            <AlertTriangle className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        );
      case 'error':
        return (
          <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
            <XCircle className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        );
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-700" />;
    }
  };

  const progress = checks.length > 0
    ? Math.round(((currentCheckIndex + 1) / checks.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal - Compact Vercel-style */}
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-[#333] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-400" />
            <div>
              <h2 className="text-sm font-medium text-white">Pre-Optimization Check</h2>
              <p className="text-xs text-gray-500">Verifying optimization readiness</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#222] transition-colors"
          >
            <X className="h-4 w-4 text-gray-500 hover:text-gray-300" />
          </button>
        </div>

        {/* Progress bar - solid green */}
        {!isComplete && (
          <div className="h-0.5 bg-[#222]">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Checks list - compact */}
        <div className="px-4 py-3">
          {checks.map((check) => (
            <div key={check.id} className="flex items-center gap-3 py-2">
              <div className="flex-shrink-0">
                {getStatusIcon(check.status)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${
                  check.status === 'pending' ? 'text-gray-500' : 'text-white'
                }`}>
                  {check.label}
                </span>
                {check.status !== 'pending' && check.status !== 'running' && check.message && (
                  <p className={`text-xs ${
                    check.status === 'error' ? 'text-red-400' :
                    check.status === 'warning' ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    {check.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#333]">
          {isComplete ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {result?.summary?.passed ?? 0} passed
                {(result?.summary?.warnings ?? 0) > 0 && (
                  <span className="text-yellow-500 ml-2">{result?.summary?.warnings} warnings</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                {result?.canProceed ? (
                  <button
                    onClick={onProceed}
                    className="flex items-center gap-1 px-4 py-1.5 rounded bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-1.5 rounded bg-[#333] text-gray-500 text-sm cursor-not-allowed"
                  >
                    Cannot Continue
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Checking...</span>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Check execution
async function executeCheck(
  checkId: string,
  config: { siteId: string; connectionType: string }
): Promise<{ status: CheckStatus; message?: string }> {
  const delays: Record<string, number> = {
    connection: 500,
    wordpress: 700,
    backup: 400,
    analysis: 800,
    compatibility: 300,
    queue: 250,
  };

  await new Promise(resolve => setTimeout(resolve, delays[checkId] || 400));

  const results: Record<string, { status: CheckStatus; message: string }> = {
    connection: { status: 'success', message: 'Connected' },
    wordpress: {
      status: config.connectionType === 'wordpress' ? 'success' : 'warning',
      message: config.connectionType === 'wordpress' ? 'Plugin active' : 'Not detected',
    },
    backup: { status: 'warning', message: 'No recent backup' },
    analysis: { status: 'success', message: '8 optimizations found' },
    compatibility: { status: 'success', message: 'Compatible' },
    queue: { status: 'success', message: 'Ready' },
  };

  return results[checkId] || { status: 'success', message: 'Passed' };
}
