// components/site-cockpit/OverallScoreHero.tsx
"use client";

import Link from "next/link";
import { TrendingUp, AlertCircle, CheckCircle, Scan, RefreshCw } from "lucide-react";
import type { Summary } from "@/types/site-cockpit";
import StatusBadge from "@/components/ui/StatusBadge";

interface OverallScoreHeroProps {
  summary: Summary;
  domain: string;
  faviconUrl?: string;
  cms?: {
    type: string;
    name?: string;
    version?: string;
  };
  // New props for actions and status
  siteId?: string;
  siteUrl?: string;
  status?: string;
  justConnected?: boolean;
}

export function OverallScoreHero({
  summary,
  domain,
  faviconUrl,
  cms,
  siteId,
  siteUrl,
  status,
  justConnected,
}: OverallScoreHeroProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 90) return "from-green-500 to-emerald-500";
    if (score >= 70) return "from-yellow-500 to-amber-500";
    if (score >= 50) return "from-orange-500 to-red-500";
    return "from-red-500 to-rose-600";
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-b border-gray-800">
      {/* Just connected success banner */}
      {justConnected && (
        <div className="relative z-10 bg-green-500/10 border-b border-green-500/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Connected successfully!</span>
              <span className="text-green-400/70">Your site is now being monitored.</span>
            </div>
          </div>
        </div>
      )}

      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(to right, rgb(59 130 246 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(59 130 246 / 0.3) 1px, transparent 1px)
          `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left: Site Info */}
          <div className="flex items-center gap-6">
            {/* Favicon */}
            {faviconUrl && (
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-1 border border-gray-700">
                  <div className="h-full w-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    <img
                      src={faviconUrl}
                      alt={`${domain} favicon`}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </div>
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-lg opacity-20 -z-10" />
              </div>
            )}

            {/* Domain & CMS & Status */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl lg:text-4xl font-bold text-white">
                  {domain}
                </h1>
                {status && <StatusBadge status={status} size="sm" />}
              </div>
              <div className="flex items-center gap-4">
                {cms && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-sm">Powered by</span>
                    <span className="text-sm font-semibold text-blue-400">
                      {cms.name || cms.type}
                    </span>
                    {cms.version && (
                      <span className="text-xs text-gray-500">
                        v{cms.version}
                      </span>
                    )}
                  </div>
                )}
                {/* Action buttons */}
                {siteId && (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/sites/${siteId}/analyze`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Scan className="h-3.5 w-3.5" />
                      Run scan
                    </Link>
                    {siteUrl && (
                      <Link
                        href={`/dashboard/sites/connect?url=${encodeURIComponent(siteUrl)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reconnect
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Score Circle */}
          <div className="relative">
            {/* Animated rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-48 w-48 rounded-full border-2 border-blue-500/20 animate-ping"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-40 w-40 rounded-full border-2 border-blue-500/30 animate-ping"
                style={{ animationDuration: "2s" }}
              />
            </div>

            {/* Score circle */}
            <div className="relative h-32 w-32 flex items-center justify-center">
              {/* Background circle */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  className="stroke-gray-800"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  className={`stroke-current ${getScoreColor(
                    summary.overallScore
                  )}`}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(summary.overallScore / 100) * 364} 364`}
                  style={{
                    filter: "drop-shadow(0 0 8px currentColor)",
                    transition: "stroke-dasharray 1s ease-in-out",
                  }}
                />
              </svg>

              {/* Score text */}
              <div className="text-center">
                <div
                  className={`text-4xl font-bold ${getScoreColor(
                    summary.overallScore
                  )}`}
                >
                  {summary.overallScore}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  {summary.grade}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            {/* Passed */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {summary.passed}
              </div>
              <div className="text-xs text-gray-500">Passed</div>
            </div>

            {/* Warnings */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {summary.warnings}
              </div>
              <div className="text-xs text-gray-500">Warnings</div>
            </div>

            {/* Critical */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-red-400">
                {summary.criticalIssues}
              </div>
              <div className="text-xs text-gray-500">Critical</div>
            </div>
          </div>
        </div>

        {/* Category Scores Bar */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.entries(summary.categoryScores).map(([category, score]) => (
            <div key={category} className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400 capitalize">
                  {category}
                </span>
                <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                  {score}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(
                    score
                  )} transition-all duration-500`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Strengths (if any) */}
        {summary.strengths && summary.strengths.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {summary.strengths.slice(0, 4).map((strength, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-sm text-green-400"
              >
                <TrendingUp className="h-3 w-3" />
                {strength}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
