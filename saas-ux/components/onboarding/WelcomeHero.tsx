// components/onboarding/WelcomeHero.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Confetti } from "./Confetti";
import { ScoreReveal } from "./ScoreReveal";
import { QuickWinsPreview } from "./QuickWinsPreview";
import { ShareButtons } from "./ShareButtons";
import { Button } from "@/components/ui/button";
import { Link } from "@/navigation";

interface WelcomeHeroProps {
  // Site info
  url: string;
  domain: string;
  faviconUrl?: string;

  // Scores
  overallScore: number;
  categoryScores?: {
    performance?: number;
    security?: number;
    seo?: number;
    accessibility?: number;
    wordpress?: number;
  };

  // Quick wins
  quickWinsCount: number;
  potentialScoreIncrease: number;
  quickWins?: Array<{
    title: string;
    impact: "critical" | "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    scoreIncrease?: number;
  }>;

  // Actions
  siteId: string;
  onViewCockpit?: () => void;
  onConnectWordPress?: () => void;

  // Customization
  showConfetti?: boolean;
  animated?: boolean;
}

/**
 * Celebratory welcome hero shown after signup with test results
 * Creates a delightful first impression with animations and clear CTAs
 */
export function WelcomeHero({
  url,
  domain,
  faviconUrl,
  overallScore,
  categoryScores,
  quickWinsCount,
  potentialScoreIncrease,
  quickWins = [],
  siteId,
  onViewCockpit,
  onConnectWordPress,
  showConfetti = true,
  animated = true,
}: WelcomeHeroProps) {
  const [showContent, setShowContent] = useState(!animated);

  useEffect(() => {
    if (animated) {
      // Delay content reveal for dramatic effect
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  const getScoreGrade = (score: number): string => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const grade = getScoreGrade(overallScore);

  return (
    <div className="relative">
      {/* Confetti */}
      {showConfetti && <Confetti duration={5000} numberOfPieces={200} />}

      {/* Main Content */}
      <div
        className={cn(
          "max-w-4xl mx-auto space-y-8 transition-all duration-700",
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Celebration Header */}
        <div className="text-center space-y-4">
          {/* Site Identity */}
          <div className="flex items-center justify-center gap-3">
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt={domain}
                className="w-12 h-12 rounded-lg shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="text-left">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Your site
              </div>
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {domain}
              </div>
            </div>
          </div>

          {/* Celebration Message */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
              <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                Analysis Complete!
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-100">
              🎉 Your site is ready!
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              We've analyzed {domain} and found opportunities to improve
            </p>
          </div>
        </div>

        {/* Score Reveal */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-lg">
          <ScoreReveal
            score={overallScore}
            label="Overall Score"
            description={`Grade ${grade} - ${
              overallScore >= 80 ? "Great job!" : "Room for improvement"
            }`}
            animated={animated}
            categoryScores={categoryScores}
          />
        </div>

        {/* Quick Wins Preview */}
        {quickWinsCount > 0 && (
          <div className="bg-gradient-to-br from-white to-green-50/30 dark:from-slate-900 dark:to-green-900/10 rounded-2xl border border-green-200 dark:border-green-800 p-6 shadow-lg">
            <QuickWinsPreview
              count={quickWinsCount}
              potentialScoreIncrease={potentialScoreIncrease}
              currentScore={overallScore}
              items={quickWins}
              maxItems={3}
            />
          </div>
        )}

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href={`/dashboard/sites/${siteId}/cockpit`}
            onClick={onViewCockpit}
          >
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full px-8 py-6 text-lg font-semibold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              View Full Cockpit Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          {categoryScores?.wordpress && (
            <Link
              href={`/dashboard/sites/connect?siteId=${siteId}`}
              onClick={onConnectWordPress}
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-full px-8 py-6 text-lg font-semibold border-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Connect WordPress
              </Button>
            </Link>
          )}
        </div>

        {/* Share Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
          <ShareButtons
            url={domain}
            score={overallScore}
            grade={grade}
            hashtags={["WebPerformance", "SiteOptimization", "GetSafe360"]}
          />
        </div>

        {/* Helper Text */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            Your full analysis is waiting in the cockpit dashboard with detailed
            recommendations, security checks, and one-click fixes.
          </p>
        </div>
      </div>
    </div>
  );
}
