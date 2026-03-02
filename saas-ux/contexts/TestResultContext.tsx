// contexts/TestResultContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EnhancedAnalysisPayload } from "@/lib/stash/types";

export interface InstantHomepageTestResult {
  url: string;
  testId: string;
  categories: Array<{
    id: string;
    severity?: "low" | "medium" | "high" | "critical";
    issues?: Array<Record<string, unknown>>;
  }>;
  summary: string;
  platform: "wordpress" | "generic";
  timestamp: string;
}

type TestResultPayload = EnhancedAnalysisPayload | InstantHomepageTestResult;

interface TestResultContextValue {
  // Current test result
  testResult: TestResultPayload | null;

  // Has a test been completed
  hasCompletedTest: boolean;

  // Update test result
  setTestResult: (payload: TestResultPayload | null) => void;

  // Clear test result
  clearTestResult: () => void;

  // Stash URL for redirecting to welcome page
  stashUrl: string | null;
  setStashUrl: (url: string | null) => void;

  // Quick access to key metrics
  overallScore: number | null;
  quickWinsCount: number | null;
  url: string | null;
}

const TestResultContext = createContext<TestResultContextValue | undefined>(
  undefined
);

export function TestResultProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [testResult, setTestResultState] =
    useState<TestResultPayload | null>(null);
  const [stashUrl, setStashUrlState] = useState<string | null>(null);

  const setTestResult = useCallback((payload: TestResultPayload | null) => {
    setTestResultState(payload);
  }, []);

  const setStashUrl = useCallback((url: string | null) => {
    setStashUrlState(url);
  }, []);

  const clearTestResult = useCallback(() => {
    setTestResultState(null);
    setStashUrlState(null);
  }, []);

  // Compute derived values
  const hasCompletedTest = testResult !== null;

  const overallScore = testResult
    ? "scores" in testResult && testResult.scores
      ? testResult.scores.overall
      : "findings" in testResult
        ? calculateOverallScore(testResult.findings)
        : calculateOverallScoreFromCategories(testResult.categories)
    : null;

  const quickWinsCount = testResult
    ? "findings" in testResult
      ? testResult.findings.filter(
          (f) => f.severity === "critical" || f.severity === "medium"
        ).length
      : testResult.categories.reduce((total, category) => {
          const issues = category.issues?.length ?? 0;
          if (category.severity === "critical" || category.severity === "high") {
            return total + issues;
          }
          if (category.severity === "medium") {
            return total + Math.ceil(issues / 2);
          }
          return total;
        }, 0)
    : null;

  const url = testResult?.url ?? null;

  const value: TestResultContextValue = {
    testResult,
    hasCompletedTest,
    setTestResult,
    clearTestResult,
    stashUrl,
    setStashUrl,
    overallScore,
    quickWinsCount,
    url,
  };

  return (
    <TestResultContext.Provider value={value}>
      {children}
    </TestResultContext.Provider>
  );
}

/**
 * Hook to access test results from any component
 */
export function useTestResult() {
  const context = useContext(TestResultContext);
  if (context === undefined) {
    throw new Error("useTestResult must be used within a TestResultProvider");
  }
  return context;
}

/**
 * Hook with safe fallback (doesn't throw if provider is missing)
 */
export function useTestResultSafe() {
  const context = useContext(TestResultContext);
  return context ?? null;
}

// Helper function to calculate overall score from findings
function calculateOverallScore(findings: any[]) {
  if (findings.length === 0) return 100;

  const critCount = findings.filter((f) => f.severity === "critical").length;
  const warnCount = findings.filter((f) => f.severity === "medium").length;
  const okCount = findings.filter((f) => f.severity === "minor").length;

  // Simple scoring: critical = -10, medium = -5, minor = -2
  const penalty = critCount * 10 + warnCount * 5 + okCount * 2;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function calculateOverallScoreFromCategories(
  categories: InstantHomepageTestResult["categories"]
) {
  const critical = categories.filter((c) => c.severity === "critical").length;
  const high = categories.filter((c) => c.severity === "high").length;
  const medium = categories.filter((c) => c.severity === "medium").length;
  const low = categories.filter((c) => c.severity === "low").length;
  const penalty = critical * 15 + high * 10 + medium * 6 + low * 3;
  return Math.max(0, Math.min(100, 100 - penalty));
}
