// components/analyzer/display/UnifiedTestResultHero.tsx
"use client";

import { TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Facts } from "@/components/analyzer/types";

interface UnifiedTestResultHeroProps {
  // Site Identity
  url: string;
  domain: string;
  faviconUrl?: string;
  cms?: {
    type: string;
    name?: string;
    version?: string;
  };

  // Scores
  overallScore: number;
  categoryScores: {
    seo: number;
    a11y: number;
    perf: number;
    sec: number;
    wordpress?: number;
  };

  // Stats (for quick boxes)
  counts: {
    seo: { pass: number; warn: number; crit: number };
    a11y: { pass: number; warn: number; crit: number };
    perf: { pass: number; warn: number; crit: number };
    sec: { pass: number; warn: number; crit: number };
  };

  // Optional facts for strengths
  facts?: Facts | null;

  // State
  isAnalyzing?: boolean;
  locale: string;
}

export function UnifiedTestResultHero({
  url,
  domain,
  faviconUrl,
  cms,
  overallScore,
  categoryScores,
  counts,
  facts,
  isAnalyzing = false,
  locale,
}: UnifiedTestResultHeroProps) {
  const t = useTranslations("TestResultHero");

  // Calculate total stats
  const totalPassed =
    counts.seo.pass + counts.a11y.pass + counts.perf.pass + counts.sec.pass;
  const totalWarnings =
    counts.seo.warn + counts.a11y.warn + counts.perf.warn + counts.sec.warn;
  const totalCritical =
    counts.seo.crit + counts.a11y.crit + counts.perf.crit + counts.sec.crit;

  // Calculate grade
  const getGrade = (score: number): string => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const grade = getGrade(overallScore);

  // Score color helpers
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

  // Auto-detect strengths from facts
  const strengths: string[] = [];
  if (facts?.isHttps) strengths.push("HTTPS enabled");
  if (categoryScores.perf >= 90) strengths.push(`Fast performance (${categoryScores.perf}/100)`);
  if (categoryScores.a11y >= 90) strengths.push("Perfect accessibility score");
  if (categoryScores.sec >= 80) strengths.push("Strong security");
  if (categoryScores.seo >= 80) strengths.push("SEO optimized");

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-b border-gray-800">
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

            {/* Domain & CMS */}
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                {domain}
              </h1>
              {cms && cms.type !== "none" && (
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-sm">Powered by</span>
                  <span className="text-sm font-semibold text-blue-400">
                    {cms.name || cms.type}
                  </span>
                  {cms.version && (
                    <span className="text-xs text-gray-500">v{cms.version}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center: Score Circle */}
          <div className="relative">
            {isAnalyzing ? (
              // Analyzing state
              <div className="h-32 w-32 flex items-center justify-center">
                <Loader2 className="h-16 w-16 text-blue-400 animate-spin" />
              </div>
            ) : (
              <>
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
                      className={`stroke-current ${getScoreColor(overallScore)}`}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(overallScore / 100) * 364} 364`}
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
                        overallScore
                      )}`}
                    >
                      {overallScore}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      {grade}
                    </div>
                  </div>
                </div>
              </>
            )}
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
                {totalPassed}
              </div>
              <div className="text-xs text-gray-500">{t("stats.passed")}</div>
            </div>

            {/* Warnings */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {totalWarnings}
              </div>
              <div className="text-xs text-gray-500">{t("stats.warnings")}</div>
            </div>

            {/* Critical */}
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-red-400">
                {totalCritical}
              </div>
              <div className="text-xs text-gray-500">{t("stats.critical")}</div>
            </div>
          </div>
        </div>

        {/* Category Scores Bar */}
        {!isAnalyzing && (
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* SEO */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  {t("categories.seo")}
                </span>
                <span
                  className={`text-sm font-bold ${getScoreColor(
                    categoryScores.seo
                  )}`}
                >
                  {categoryScores.seo}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(
                    categoryScores.seo
                  )} transition-all duration-500`}
                  style={{ width: `${categoryScores.seo}%` }}
                />
              </div>
            </div>

            {/* Accessibility */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  {t("categories.accessibility")}
                </span>
                <span
                  className={`text-sm font-bold ${getScoreColor(
                    categoryScores.a11y
                  )}`}
                >
                  {categoryScores.a11y}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(
                    categoryScores.a11y
                  )} transition-all duration-500`}
                  style={{ width: `${categoryScores.a11y}%` }}
                />
              </div>
            </div>

            {/* Performance */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  {t("categories.performance")}
                </span>
                <span
                  className={`text-sm font-bold ${getScoreColor(
                    categoryScores.perf
                  )}`}
                >
                  {categoryScores.perf}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(
                    categoryScores.perf
                  )} transition-all duration-500`}
                  style={{ width: `${categoryScores.perf}%` }}
                />
              </div>
            </div>

            {/* Security */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  {t("categories.security")}
                </span>
                <span
                  className={`text-sm font-bold ${getScoreColor(
                    categoryScores.sec
                  )}`}
                >
                  {categoryScores.sec}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getScoreGradient(
                    categoryScores.sec
                  )} transition-all duration-500`}
                  style={{ width: `${categoryScores.sec}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Strengths (if any) */}
        {!isAnalyzing && strengths.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {strengths.slice(0, 4).map((strength, i) => (
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
