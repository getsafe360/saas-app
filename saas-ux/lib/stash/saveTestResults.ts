// lib/stash/saveTestResults.ts
// Client-side utility to stash test results to Blob storage

import type { EnhancedAnalysisPayload } from "./types";
import type { Finding } from "@/components/analyzer/types";

/**
 * Calculate simple scores from findings
 */
function calculateScores(findings: Finding[]) {
  const pillars = {
    seo: findings.filter((f) => f.pillar === "seo"),
    a11y: findings.filter((f) => f.pillar === "a11y"),
    perf: findings.filter((f) => f.pillar === "perf"),
    sec: findings.filter((f) => f.pillar === "sec"),
  };

  const getScore = (items: Finding[]) => {
    if (items.length === 0) return 100;
    const critCount = items.filter((f) => f.severity === "critical").length;
    const warnCount = items.filter((f) => f.severity === "medium").length;
    const okCount = items.filter((f) => f.severity === "minor").length;
    const total = items.length;

    // Simple scoring: critical = -10, medium = -5, minor = -2
    const penalty = critCount * 10 + warnCount * 5 + okCount * 2;
    return Math.max(0, Math.min(100, 100 - penalty));
  };

  const scores = {
    seo: getScore(pillars.seo),
    a11y: getScore(pillars.a11y),
    perf: getScore(pillars.perf),
    sec: getScore(pillars.sec),
  };

  const overall = Math.round(
    (scores.seo + scores.a11y + scores.perf + scores.sec) / 4
  );

  return { overall, ...scores };
}

/**
 * Estimate quick wins count from findings
 * Quick wins = high impact + low effort = critical/medium severity issues
 */
function estimateQuickWins(findings: Finding[]) {
  const quickWins = findings.filter(
    (f) => f.severity === "critical" || f.severity === "medium"
  );

  const count = Math.min(quickWins.length, 10); // Cap at 10
  const potentialIncrease = count * 2; // Each quick win could add ~2-3 points

  return { count, potentialIncrease };
}

/**
 * Save test results to blob storage via API
 * Returns stash URL that can be passed to Clerk redirect
 */
export async function saveTestResults(
  payload: EnhancedAnalysisPayload
): Promise<{ stashKey: string; stashUrl: string } | null> {
  try {
    const scores = calculateScores(payload.findings);
    const { count: quickWinsCount, potentialIncrease: potentialScoreIncrease } =
      estimateQuickWins(payload.findings);

    // Prepare stash payload
    const stashData = {
      url: payload.url,
      markdown: payload.markdown,
      findings: payload.findings,
      facts: payload.facts,
      locale: payload.locale,
      timestamp: payload.timestamp,
      scores,
      quickWinsCount,
      potentialScoreIncrease,
      screenshotUrls: payload.screenshotUrls
        ? {
            desktop: payload.screenshotUrls.desktopHi,
            mobile: payload.screenshotUrls.mobileHi,
          }
        : undefined,
    };

    // Call stash API
    const response = await fetch("/api/stash-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stashData),
    });

    if (!response.ok) {
      console.error("Failed to stash test results:", response.status);
      return null;
    }

    const result = await response.json();

    if (result.ok && result.stashKey && result.url) {
      return {
        stashKey: result.stashKey,
        stashUrl: result.url,
      };
    }

    return null;
  } catch (error) {
    console.error("Error stashing test results:", error);
    return null;
  }
}

/**
 * Store test results in sessionStorage as a backup
 * Survives page refresh but not tab close
 */
export function backupToSessionStorage(payload: EnhancedAnalysisPayload) {
  try {
    const scores = calculateScores(payload.findings);
    const { count: quickWinsCount, potentialIncrease: potentialScoreIncrease } =
      estimateQuickWins(payload.findings);

    const backup = {
      url: payload.url,
      scores,
      quickWinsCount,
      potentialScoreIncrease,
      faviconUrl: payload.facts?.faviconUrl,
      timestamp: payload.timestamp,
    };

    sessionStorage.setItem("getsafe360_test_backup", JSON.stringify(backup));
  } catch (error) {
    // sessionStorage might be disabled
    console.warn("Failed to backup to sessionStorage:", error);
  }
}

/**
 * Retrieve backup from sessionStorage
 */
export function getBackupFromSessionStorage() {
  try {
    const backup = sessionStorage.getItem("getsafe360_test_backup");
    if (backup) {
      return JSON.parse(backup);
    }
  } catch (error) {
    console.warn("Failed to retrieve backup from sessionStorage:", error);
  }
  return null;
}

/**
 * Clear backup from sessionStorage
 */
export function clearBackupFromSessionStorage() {
  try {
    sessionStorage.removeItem("getsafe360_test_backup");
  } catch (error) {
    // Ignore
  }
}
