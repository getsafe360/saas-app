// contexts/TestResultContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EnhancedAnalysisPayload } from "@/lib/stash/types";

interface TestResultContextValue {
  // Current test result
  testResult: EnhancedAnalysisPayload | null;

  // Has a test been completed
  hasCompletedTest: boolean;

  // Update test result
  setTestResult: (payload: EnhancedAnalysisPayload | null) => void;

  // Clear test result
  clearTestResult: () => void;

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
    useState<EnhancedAnalysisPayload | null>(null);

  const setTestResult = useCallback((payload: EnhancedAnalysisPayload | null) => {
    setTestResultState(payload);
  }, []);

  const clearTestResult = useCallback(() => {
    setTestResultState(null);
  }, []);

  // Compute derived values
  const hasCompletedTest = testResult !== null;

  const overallScore = testResult
    ? testResult.scores?.overall ??
      calculateOverallScore(testResult.findings)
    : null;

  const quickWinsCount = testResult
    ? testResult.findings.filter(
        (f) => f.severity === "critical" || f.severity === "medium"
      ).length
    : null;

  const url = testResult?.url ?? null;

  const value: TestResultContextValue = {
    testResult,
    hasCompletedTest,
    setTestResult,
    clearTestResult,
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
