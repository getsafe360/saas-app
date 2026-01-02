// components/site-cockpit/cards/optimization/components/QuickWins/QuickWinCard.tsx
"use client";

import { useState } from "react";
import {
  Wrench,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Shield,
  TrendingDown,
} from "lucide-react";
import type { QuickWinCardProps } from "../../types";

export function QuickWinCard({
  quickWin,
  siteId,
  connection,
  backupSystem,
  onOptimize,
  onBackup,
}: QuickWinCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [backupCreated, setBackupCreated] = useState(false);

  const handleOptimize = async () => {
    try {
      // Create backup first if required and not already created
      if (quickWin.requiresBackup && !backupCreated) {
        setIsBackingUp(true);
        await onBackup();
        setBackupCreated(true);
        setIsBackingUp(false);
      }

      // Run optimization
      setIsOptimizing(true);
      await onOptimize(quickWin.id);
      setIsOptimizing(false);
    } catch (error) {
      console.error("Optimization failed:", error);
      setIsBackingUp(false);
      setIsOptimizing(false);
    }
  };

  // Check if optimization is compatible with current connection
  const isCompatible =
    (connection.method === "wordpress" && quickWin.compatibility?.wordpress) ||
    (connection.method === "ftp" && !quickWin.compatibility?.requiresSSH) ||
    connection.method === "ssh" ||
    (connection.method === "none" && quickWin.compatibility?.static);

  const impactColors = {
    high: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400",
    },
    medium: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      text: "text-orange-400",
    },
    low: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      text: "text-yellow-400",
    },
  };

  const statusColors = {
    pending: "text-gray-400",
    "backing-up": "text-blue-400",
    optimizing: "text-blue-400",
    completed: "text-green-400",
    failed: "text-red-400",
    "rolled-back": "text-orange-400",
  };

  const impact = impactColors[quickWin.impact];

  return (
    <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-base font-semibold text-white">
              {quickWin.title}
            </h4>

            {/* Impact Badge */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${impact.bg} ${impact.border} ${impact.text}`}
            >
              {quickWin.impact.toUpperCase()} Impact
            </span>
          </div>

          <p className="text-sm text-gray-400">{quickWin.description}</p>
        </div>
      </div>

      {/* Metrics: Before → After */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-gray-900/40">
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-sm font-semibold text-red-400">
            {quickWin.current.value}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-gray-600 flex-shrink-0" />

        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Optimized</div>
          <div className="text-sm font-semibold text-green-400">
            {quickWin.optimized.value}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <TrendingDown className="h-4 w-4 text-green-400" />
          <span className="text-sm font-bold text-green-400">
            {quickWin.savings.percentage}%
          </span>
        </div>
      </div>

      {/* Savings Info */}
      <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <div>
            <div className="text-sm font-semibold text-blue-400">
              {quickWin.savings.absolute} saved
            </div>
            {quickWin.savings.timeImpact && (
              <div className="text-xs text-gray-500">
                {quickWin.savings.timeImpact}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risks (expandable) */}
      {quickWin.risks.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <span>View risks ({quickWin.risks.length})</span>
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
              <ul className="space-y-1">
                {quickWin.risks.map((risk, index) => (
                  <li
                    key={index}
                    className="text-xs text-gray-400 flex items-start gap-2"
                  >
                    <span className="text-orange-400 mt-0.5">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Optimize Button */}
        <button
          onClick={handleOptimize}
          disabled={
            !isCompatible ||
            isBackingUp ||
            isOptimizing ||
            quickWin.status === "completed"
          }
          className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
            !isCompatible
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : isBackingUp || isOptimizing
              ? "bg-blue-600 text-white cursor-wait"
              : quickWin.status === "completed"
              ? "bg-green-600 text-white cursor-default"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {isBackingUp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Backup...
            </>
          ) : isOptimizing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Optimizing...
            </>
          ) : quickWin.status === "completed" ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Completed
            </>
          ) : (
            <>
              <Wrench className="h-4 w-4" />
              One-Click Fix
            </>
          )}
        </button>

        {/* Backup Badge */}
        {quickWin.requiresBackup && (
          <div
            className={`px-3 py-2 rounded-lg border ${
              backupCreated
                ? "bg-green-500/10 border-green-500/20"
                : "bg-gray-700/50 border-gray-600/50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Shield
                className={`h-4 w-4 ${
                  backupCreated ? "text-green-400" : "text-gray-500"
                }`}
              />
              <span
                className={`text-xs font-semibold ${
                  backupCreated ? "text-green-400" : "text-gray-500"
                }`}
              >
                {backupCreated ? "Backup Ready" : "Backup Required"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compatibility Warning */}
      {!isCompatible && (
        <div className="mt-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-orange-400">
              {quickWin.compatibility?.requiresSSH
                ? "Requires SSH connection"
                : quickWin.compatibility?.requiresFTP
                ? "Requires FTP/SFTP connection"
                : "Not compatible with current connection method"}
            </div>
          </div>
        </div>
      )}

      {/* Estimated Time */}
      {quickWin.estimatedTime && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Estimated time: ~{quickWin.estimatedTime}s
        </div>
      )}
    </div>
  );
}
