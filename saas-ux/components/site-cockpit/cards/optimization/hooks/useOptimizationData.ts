// components/site-cockpit/cards/optimization/hooks/useOptimizationData.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  PerformanceMetrics,
  OptimizationComparison,
  Savings,
  QuickWin,
  OptimizationHistoryEntry,
  UseOptimizationDataReturn,
} from "../types";
import {
  calculatePotentialImprovements,
  calculateSavings,
  generateQuickWins,
  sortQuickWins,
  calculateScore,
  getGrade,
} from "../utils/calculations";
import type { SiteCockpitResponse } from "@/types/site-cockpit";

export function useOptimizationData(
  data: SiteCockpitResponse,
  siteId?: string
): UseOptimizationDataReturn {
  const [comparison, setComparison] = useState<OptimizationComparison | null>(null);
  const [savings, setSavings] = useState<Savings | null>(null);
  const [quickWins, setQuickWins] = useState<QuickWin[]>([]);
  const [history, setHistory] = useState<OptimizationHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processOptimizationData = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      // Extract current metrics from API data
      const currentMetrics: PerformanceMetrics = {
        score: data.performance?.score || 0,
        grade: data.performance?.grade || "F",
        pageWeight: data.performance?.pageWeight?.totalBytes || 0,
        requests: data.performance?.requests?.total || 0,
        loadTime: data.performance?.metrics?.loadTime || 0,
        ttfb: data.performance?.metrics?.timeToFirstByte || 0,
      };

      // Ensure we have a valid score
      if (currentMetrics.score === 0) {
        currentMetrics.score = calculateScore(currentMetrics);
        currentMetrics.grade = getGrade(currentMetrics.score);
      }

      // Determine what optimizations are needed
      const neededOptimizations = determineNeededOptimizations(data);

      // Calculate potential improvements
      const potentialMetrics = calculatePotentialImprovements(
        currentMetrics,
        neededOptimizations
      );

      // Create comparison
      const optimizationComparison: OptimizationComparison = {
        before: currentMetrics,
        after: currentMetrics, // Initially same as before
        potential: potentialMetrics,
      };

      setComparison(optimizationComparison);

      // Calculate potential savings
      const potentialSavings = calculateSavings(
        currentMetrics,
        potentialMetrics,
        10000 // Assume 10k monthly visits
      );

      setSavings(potentialSavings);

      // Generate quick wins
      const hasImages = (data.performance?.requests?.images || 0) > 0;
      const hasCaching = data.performance?.caching?.browserCacheEnabled || false;
      const hasCompression = data.performance?.compression?.enabled || false;
      const hasMinification = false; // TODO: Detect from API

      const wins = generateQuickWins(
        currentMetrics,
        hasImages,
        hasCaching,
        hasCompression,
        hasMinification
      );

      setQuickWins(sortQuickWins(wins));

      // TODO: Load history from API if available
      setHistory([]);

      setIsLoading(false);
    } catch (err) {
      console.error("Error processing optimization data:", err);
      setError(err instanceof Error ? err.message : "Failed to process data");
      setIsLoading(false);
    }
  }, [data]);

  // Process data on mount and when data changes
  useEffect(() => {
    processOptimizationData();
  }, [processOptimizationData]);

  // Refresh function
  const refresh = useCallback(async () => {
    processOptimizationData();
  }, [processOptimizationData]);

  return {
    comparison: comparison!,
    savings: savings!,
    quickWins,
    history,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Determine which optimizations are needed based on current state
 */
function determineNeededOptimizations(
  data: SiteCockpitResponse
): Array<"images" | "caching" | "compression" | "minification" | "security-headers" | "database" | "lazy-loading" | "cdn"> {
  const needed: any[] = [];

  // Check for images
  if ((data.performance?.requests?.images || 0) > 0) {
    needed.push("images");
  }

  // Check for caching
  if (!data.performance?.caching?.browserCacheEnabled) {
    needed.push("caching");
  }

  // Check for compression
  if (!data.performance?.compression?.enabled) {
    needed.push("compression");
  }

  // Check for minification (assume needed if CSS/JS exists)
  if ((data.performance?.requests?.css || 0) > 0 || (data.performance?.requests?.js || 0) > 0) {
    needed.push("minification");
  }

  // Check for security headers
  const headers = data.security?.headers || {};
  const hasAllHeaders = Object.values(headers).every((h: any) => h?.present);
  if (!hasAllHeaders) {
    needed.push("security-headers");
  }

  // Lazy loading (assume needed if images exist)
  if ((data.performance?.requests?.images || 0) > 5) {
    needed.push("lazy-loading");
  }

  // CDN (assume needed if not detected)
  if (!data.performance?.cdn?.detected) {
    needed.push("cdn");
  }

  return needed;
}