// components/site-cockpit/cards/optimization/components/PreFlight/PreFlightCheckModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, AlertTriangle, XCircle, Loader2, Rocket, ChevronRight } from "lucide-react";
import type { PreFlightCheck, PreFlightResult, PreFlightModalProps, CheckStatus } from "./types";
import { DEFAULT_CHECKS } from "./types";

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

  // Initialize checks when modal opens
  useEffect(() => {
    if (isOpen) {
      // Filter checks based on connection type
      const applicableChecks = DEFAULT_CHECKS.filter(check => {
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

      // Start checks after a brief delay
      setTimeout(() => runChecks(applicableChecks), 500);
    }
  }, [isOpen, config.connectionType]);

  // Run all checks sequentially with streaming effect
  const runChecks = useCallback(async (initialChecks: PreFlightCheck[]) => {
    const updatedChecks = [...initialChecks];
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    const warningMessages: string[] = [];
    const errorMessages: string[] = [];

    for (let i = 0; i < updatedChecks.length; i++) {
      setCurrentCheckIndex(i);

      // Set current check to running
      updatedChecks[i] = { ...updatedChecks[i], status: 'running' };
      setChecks([...updatedChecks]);

      // Simulate check execution (replace with real API calls)
      const checkResult = await executeCheck(updatedChecks[i].id, config);

      // Update check with result
      updatedChecks[i] = {
        ...updatedChecks[i],
        status: checkResult.status,
        message: checkResult.message,
        duration: checkResult.duration,
      };
      setChecks([...updatedChecks]);

      // Track results
      if (checkResult.status === 'success') passed++;
      else if (checkResult.status === 'warning') {
        warnings++;
        if (checkResult.message) warningMessages.push(checkResult.message);
      } else if (checkResult.status === 'error') {
        failed++;
        if (checkResult.message) errorMessages.push(checkResult.message);
      }

      // Small delay between checks for visual effect
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Build final result
    const finalResult: PreFlightResult = {
      checks: updatedChecks,
      canProceed: failed === 0,
      warnings: warningMessages,
      errors: errorMessages,
      summary: {
        totalChecks: updatedChecks.length,
        passed,
        warnings,
        failed,
      },
    };

    setResult(finalResult);
    setIsComplete(true);
    onComplete(finalResult);
  }, [config, onComplete]);

  if (!isOpen) return null;

  const getStatusIcon = (status: CheckStatus, isActive: boolean) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case 'success':
        return <Check className="h-5 w-5 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return (
          <div className={`h-5 w-5 rounded-full border-2 ${
            isActive ? 'border-blue-400' : 'border-gray-600'
          }`} />
        );
    }
  };

  const getStatusText = (status: CheckStatus) => {
    switch (status) {
      case 'running': return 'Checking...';
      case 'success': return 'Passed';
      case 'warning': return 'Warning';
      case 'error': return 'Failed';
      default: return 'Pending';
    }
  };

  const progress = checks.length > 0
    ? Math.round(((currentCheckIndex + 1) / checks.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Rocket className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Pre-Flight Check</h2>
              <p className="text-sm text-gray-400">Verifying optimization readiness</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checks list */}
        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
          {checks.map((check, index) => {
            const isActive = index === currentCheckIndex;
            const isPast = index < currentCheckIndex;
            const isFuture = index > currentCheckIndex;

            return (
              <div
                key={check.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : check.status === 'error'
                    ? 'bg-red-500/10 border-red-500/20'
                    : check.status === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/20'
                    : check.status === 'success'
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-gray-800/30 border-gray-700/50'
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(check.status, isActive)}
                </div>

                {/* Check info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium ${
                      isFuture ? 'text-gray-500' : 'text-white'
                    }`}>
                      {check.label}
                    </span>
                    {check.duration && (
                      <span className="text-xs text-gray-500">
                        {(check.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {/* Description or message */}
                  {(check.message || check.description) && (
                    <p className={`text-sm mt-1 ${
                      check.status === 'error'
                        ? 'text-red-400'
                        : check.status === 'warning'
                        ? 'text-yellow-400'
                        : check.status === 'success'
                        ? 'text-green-400'
                        : 'text-gray-500'
                    }`}>
                      {check.message || check.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          {isComplete ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-green-400">
                    {result?.summary?.passed ?? 0} passed
                  </span>
                  {(result?.summary?.warnings ?? 0) > 0 && (
                    <span className="text-yellow-400">
                      {result?.summary?.warnings} warnings
                    </span>
                  )}
                  {(result?.summary?.failed ?? 0) > 0 && (
                    <span className="text-red-400">
                      {result?.summary?.failed} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                {result?.canProceed ? (
                  <button
                    onClick={onProceed}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold transition-all"
                  >
                    Start Optimization
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gray-700 text-gray-500 cursor-not-allowed"
                  >
                    Cannot Proceed
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Running checks... {progress}%
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
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

// Simulate check execution (replace with real API calls)
async function executeCheck(
  checkId: string,
  config: { siteId: string; connectionType: string }
): Promise<{ status: CheckStatus; message?: string; duration: number }> {
  const startTime = Date.now();

  // Simulate different check durations
  const delays: Record<string, number> = {
    connection: 800,
    wordpress: 1200,
    backup: 600,
    analysis: 1500,
    compatibility: 500,
    queue: 400,
  };

  await new Promise(resolve => setTimeout(resolve, delays[checkId] || 500));

  const duration = Date.now() - startTime;

  // Simulate check results (in production, call actual API)
  const results: Record<string, { status: CheckStatus; message: string }> = {
    connection: { status: 'success', message: 'Site is reachable' },
    wordpress: {
      status: config.connectionType === 'wordpress' ? 'success' : 'warning',
      message: config.connectionType === 'wordpress'
        ? 'WordPress plugin active (v1.2.0)'
        : 'WordPress not detected',
    },
    backup: {
      status: 'warning',
      message: 'No recent backup found (recommended before optimization)',
    },
    analysis: { status: 'success', message: 'Found 8 optimization opportunities' },
    compatibility: { status: 'success', message: 'All optimizations are compatible' },
    queue: { status: 'success', message: 'Optimization queue ready' },
  };

  return {
    ...results[checkId] || { status: 'success', message: 'Check passed' },
    duration,
  };
}
