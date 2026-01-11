// components/onboarding/ScoreReveal.tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface ScoreRevealProps {
  score: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  description?: string;
  animated?: boolean;
  duration?: number;
  categoryScores?: {
    performance?: number;
    security?: number;
    seo?: number;
    accessibility?: number;
    wordpress?: number;
  };
}

const sizeConfig = {
  sm: {
    circle: 120,
    stroke: 8,
    text: "text-3xl",
    label: "text-sm",
  },
  md: {
    circle: 160,
    stroke: 10,
    text: "text-4xl",
    label: "text-base",
  },
  lg: {
    circle: 200,
    stroke: 12,
    text: "text-5xl",
    label: "text-lg",
  },
  xl: {
    circle: 240,
    stroke: 14,
    text: "text-6xl",
    label: "text-xl",
  },
};

function getScoreColor(score: number): string {
  if (score >= 90) return "#10B981"; // green
  if (score >= 70) return "#F59E0B"; // yellow/orange
  if (score >= 50) return "#F97316"; // orange
  return "#EF4444"; // red
}

function getScoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Animated score reveal with circular progress
 */
export function ScoreReveal({
  score,
  maxScore = 100,
  size = "lg",
  label = "Overall Score",
  description,
  animated = true,
  duration = 2000,
  categoryScores,
}: ScoreRevealProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const [hasAnimated, setHasAnimated] = useState(false);

  const config = sizeConfig[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = (displayScore / maxScore) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Animate score counting
  useEffect(() => {
    if (!animated || hasAnimated) return;

    const steps = 60;
    const increment = score / steps;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(score);
        clearInterval(timer);
        setHasAnimated(true);
      } else {
        setDisplayScore(Math.round(increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [score, animated, duration, hasAnimated]);

  const color = getScoreColor(displayScore);
  const grade = getScoreGrade(displayScore);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main Score Circle */}
      <div className="relative" style={{ width: config.circle, height: config.circle }}>
        {/* Background circle */}
        <svg
          className="transform -rotate-90"
          width={config.circle}
          height={config.circle}
        >
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={config.stroke}
            fill="none"
            className="text-slate-200 dark:text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            stroke={color}
            strokeWidth={config.stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn("font-bold", config.text)} style={{ color }}>
            {displayScore}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            / {maxScore}
          </div>
          <div
            className={cn("font-semibold mt-1", config.label)}
            style={{ color }}
          >
            Grade {grade}
          </div>
        </div>
      </div>

      {/* Label and description */}
      {label && (
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </div>
          {description && (
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {description}
            </div>
          )}
        </div>
      )}

      {/* Category scores */}
      {categoryScores && (
        <div className="w-full max-w-md space-y-3">
          {Object.entries(categoryScores)
            .filter(([, value]) => value !== undefined)
            .map(([category, value]) => {
              const categoryColor = getScoreColor(value);
              const categoryPercentage = (value / 100) * 100;

              return (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                      {category}
                    </span>
                    <span className="font-semibold" style={{ color: categoryColor }}>
                      {value}/100
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${categoryPercentage}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
