// lib/optimization/fixes/fixPolicies.ts
// Safety policy for fixes before they are applied

import type { FixPlan, FixSafetyResult, RiskLevel } from '../loops/types';
import type { OptimizationMode } from '@/lib/db/schema';

// Low-risk fix types that safe_auto mode can apply without approval
const LOW_RISK_FIX_IDS = new Set([
  'seo-meta-description',
  'seo-canonical',
  'seo-og-title',
  'seo-og-description',
  'seo-og-image',
  'seo-og-type',
  'seo-og-url',
  'seo-og-site-name',
  'seo-twitter-card',
  'seo-twitter-title',
  'seo-twitter-description',
  'seo-website-schema',
  'seo-organization-schema',
  'perf-preconnect',
  'perf-dns-prefetch',
]);

// Fix ID prefixes that are always low-risk
const LOW_RISK_PREFIXES = ['seo-meta-', 'seo-og-', 'seo-twitter-', 'seo-canonical', 'seo-website-schema', 'seo-organization-schema'];

// Fix ID prefixes that are always high-risk (never auto-apply)
const HIGH_RISK_PREFIXES = ['php-', 'htaccess-', 'csp-', 'plugin-', 'theme-', 'db-', 'wp-core-'];

function classifyRisk(fixPlan: FixPlan): RiskLevel {
  const id = fixPlan.fixId;

  if (HIGH_RISK_PREFIXES.some((p) => id.startsWith(p))) return 'high';
  if (fixPlan.fixType === 'manual_instruction') return 'medium';
  if (LOW_RISK_FIX_IDS.has(id)) return 'low';
  if (LOW_RISK_PREFIXES.some((p) => id.startsWith(p))) return 'low';

  // Default: medium for anything else
  return 'medium';
}

export function evaluateFixSafety(
  fixPlan: FixPlan,
  mode: OptimizationMode,
): FixSafetyResult {
  const riskLevel = classifyRisk(fixPlan);

  if (mode === 'report_only') {
    return {
      allowed: false,
      riskLevel,
      requiresApproval: false,
      reason: 'Loop is in report_only mode — no fixes will be applied.',
    };
  }

  if (riskLevel === 'high') {
    return {
      allowed: false,
      riskLevel,
      requiresApproval: true,
      reason: 'High-risk fix requires manual review and is not auto-applied.',
    };
  }

  if (riskLevel === 'medium') {
    if (mode === 'safe_auto') {
      return {
        allowed: false,
        riskLevel,
        requiresApproval: true,
        reason: 'Medium-risk fix requires approval before it can be applied.',
      };
    }
    // approval_required mode: mark as needing approval but allowed in principle
    return {
      allowed: false,
      riskLevel,
      requiresApproval: true,
      reason: 'This fix requires your approval before we change the live site.',
    };
  }

  // Low risk — allowed in both safe_auto and approval_required modes
  return {
    allowed: true,
    riskLevel: 'low',
    requiresApproval: false,
  };
}

// Validate that a snippet contains only allowlisted HTML
export function validateSnippet(snippet: string): { valid: boolean; reason?: string } {
  const s = snippet.trim();

  // Must be a <meta>, <link>, or <script type="application/ld+json">
  if (
    s.startsWith('<meta ') ||
    s.startsWith('<link ') ||
    (s.startsWith('<script') && s.includes('application/ld+json'))
  ) {
    // Reject anything with javascript: or event handlers
    if (/javascript:/i.test(s) || /\bon\w+\s*=/i.test(s)) {
      return { valid: false, reason: 'Snippet contains unsafe attributes.' };
    }
    return { valid: true };
  }

  return {
    valid: false,
    reason: 'Only <meta>, <link>, and JSON-LD <script> tags are allowed.',
  };
}
