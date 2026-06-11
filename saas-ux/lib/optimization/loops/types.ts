// lib/optimization/loops/types.ts
// Core types for the optimization loop system

import type { LoopStatus, LoopStopReason, OptimizationMode, IterationStatus } from '@/lib/db/schema';

// ── Fix types allowed in MVP ──────────────────────────────────────────────────

export type FixType =
  | 'head_snippet'   // <meta> or <link> tag injected via wp_head
  | 'json_ld'        // <script type="application/ld+json"> via wp_head
  | 'meta_tag'       // Specific meta tag (subset of head_snippet)
  | 'link_tag'       // Specific link tag (subset of head_snippet)
  | 'manual_instruction'; // No auto-apply; human must act

// ── Risk levels ───────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FixSafetyResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  reason?: string;
}

// ── Fix plan ──────────────────────────────────────────────────────────────────

export interface FixPlan {
  fixId: string;       // Unique ID for deduplication and rollback
  fixType: FixType;
  title: string;
  summary: string;
  issueId: string;
  issueTitle: string;
  issueSeverity: string;
  // The WordPress connector payload
  connectorFix: {
    id: string;
    fixType: 'code' | 'config' | 'manual';
    title: string;
    section: string;
    summary: string;
    snippet?: string;
  };
  // For rollback: what to do to reverse this fix
  rollbackPayload?: {
    action: 'delete_fix';
    fixId: string;
  };
}

// ── Scan snapshot ─────────────────────────────────────────────────────────────

export interface SiteSnapshot {
  siteId: string;
  siteUrl: string;
  scores: Record<string, number>;
  // SEO facts extracted from the page
  seoFacts: {
    pageTitle?: string;
    metaDescription?: string;
    hasCanonical?: boolean;
    canonicalUrl?: string;
    hasOgTitle?: boolean;
    hasOgDescription?: boolean;
    hasOgImage?: boolean;
    hasTwitterCard?: boolean;
    hasOrganizationSchema?: boolean;
    hasWebsiteSchema?: boolean;
    hasFaqSchema?: boolean;
    orgName?: string;       // Extracted from OG site_name or title
    h1Text?: string;
  };
  // Raw findings from the latest scan (for issue selection)
  findings?: Array<{
    id: string;
    category?: string;
    section?: string;
    title: string;
    severity: string;
    automatedFix?: {
      type: string;
      snippet?: string;
      description?: string;
    };
    passed?: boolean;
  }>;
}

// ── Loop runner inputs/outputs ────────────────────────────────────────────────

export interface RunLoopInput {
  loopId: string;
  siteId: string;
  siteUrl: string;
  siteToken: string;       // Plain token for WP connector auth
  category: string;
  goalScore: number;
  maxIterations: number;
  mode: OptimizationMode;
  stopOnRegression?: boolean;
  snapshot: SiteSnapshot;
}

export interface LoopEvent {
  type: 'status_change' | 'fix_applied' | 'fix_skipped' | 'fix_failed' | 'iteration_complete' | 'loop_complete';
  iterationNumber?: number;
  title?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  scoreBefore?: number;
  scoreAfter?: number;
  fixType?: string;
  message?: string;
  timestamp: string;
}

export interface LoopStatusResponse {
  id: string;
  siteId: string;
  category: string;
  status: LoopStatus;
  mode: OptimizationMode;
  startingScore: number | null;
  currentScore: number | null;
  goalScore: number;
  currentIteration: number;
  maxIterations: number;
  stopReason: LoopStopReason | null;
  events: LoopEvent[];
  iterations: Array<{
    id: string;
    iterationNumber: number;
    issueTitle: string;
    issueSeverity: string;
    fixType: string;
    scoreBefore: number;
    scoreAfter: number | null;
    status: IterationStatus;
    verificationResult: unknown;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
