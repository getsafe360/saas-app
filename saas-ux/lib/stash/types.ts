// lib/stash/types.ts
// TypeScript types for test result stashing

import type { AnalysisPayload, Finding, Facts } from "@/components/analyzer/types";
import type { SiteCockpitResponse } from "@/types/site-cockpit";

/**
 * Stashed test result payload - simplified version for storage
 * Contains everything needed to recreate the test experience after signup
 */
export interface StashedTestResult {
  // Core test data
  url: string;
  markdown: string;
  findings: Finding[];
  facts: Facts | null;
  locale: string;
  timestamp: string;

  // Computed scores (for quick display)
  scores?: {
    overall: number;
    seo: number;
    a11y: number;
    perf: number;
    sec: number;
  };

  // Quick wins (if available)
  quickWinsCount?: number;
  potentialScoreIncrease?: number;

  // Screenshot URLs (for preview)
  screenshotUrls?: {
    desktop: string;
    mobile: string;
  };

  // Metadata
  v: number; // schema version
  createdAt: number;
}

/**
 * Response from stashing API
 */
export interface StashResponse {
  ok: boolean;
  stashKey?: string;
  stashUrl?: string;
  error?: string;
}

/**
 * Enhanced analysis payload with computed data
 */
export interface EnhancedAnalysisPayload extends AnalysisPayload {
  screenshotUrls?: {
    desktopHi: string;
    desktopLo: string;
    mobileHi: string;
    mobileLo: string;
  };
}
