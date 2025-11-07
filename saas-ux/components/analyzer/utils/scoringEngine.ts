// components/analyzer/utils/scoringEngine.ts
import type { Finding } from '../types';

export type PillarScore = {
  ok: number;
  warn: number;
  crit: number;
  total: number;
  percentage: number;
};

export type Scores = {
  seo: PillarScore;
  a11y: PillarScore;
  perf: PillarScore;
  sec: PillarScore;
  overall: number;
};

export type QuickIssues = {
  seo: {
    noTitle?: boolean;
    titleTooShort?: boolean;
    titleTooLong?: boolean;
    noMetaDescription?: boolean;
    multipleH1?: boolean;
    imagesNoAlt?: number;
    noCanonical?: boolean;
    noOpenGraph?: boolean;
  };
  a11y: {
    lowContrast?: number;
    missingLang?: boolean;
    buttonsNoLabel?: number;
    linksNoText?: number;
    formInputsNoLabels?: number;
    imagesNoAltA11y?: number;
  };
  perf: {
    tooManyResources?: boolean;
    largeDOM?: boolean;
    noLazyLoading?: number;
    inlineStyles?: number;
    blockingScripts?: number;
  };
  sec: {
    notHttps?: boolean;
    mixedContent?: number;
    noCSP?: boolean;
    inlineJavaScript?: number;
  };
};

export type QuickScores = {
  seo: number;
  a11y: number;
  perf: number;
  sec: number;
  overall: number;
};

/**
 * Calculate scores from parsed findings (used after full AI analysis)
 */
export function calculateScores(findings: Finding[]): Scores {
  const scores = {
    seo: { ok: 0, warn: 0, crit: 0, total: 0, percentage: 0 },
    a11y: { ok: 0, warn: 0, crit: 0, total: 0, percentage: 0 },
    perf: { ok: 0, warn: 0, crit: 0, total: 0, percentage: 0 },
    sec: { ok: 0, warn: 0, crit: 0, total: 0, percentage: 0 },
    overall: 100,
  };

  for (const finding of findings) {
    const pillar = scores[finding.pillar];
    pillar.total++;
    
    if (finding.severity === 'minor') pillar.ok++;
    else if (finding.severity === 'medium') pillar.warn++;
    else pillar.crit++;
  }

  // Calculate percentages
  let totalDeductions = 0;
  for (const key of ['seo', 'a11y', 'perf', 'sec'] as const) {
    const pillar = scores[key];
    if (pillar.total > 0) {
      pillar.percentage = Math.round(
        ((pillar.ok * 1 + pillar.warn * 0.5 + pillar.crit * 0) / pillar.total) * 100
      );
      totalDeductions += (pillar.warn * 2 + pillar.crit * 5);
    } else {
      pillar.percentage = 100;
    }
  }

  scores.overall = Math.max(0, 100 - totalDeductions);
  return scores;
}

/**
 * Calculate quick scores from instant DOM checks (used during screenshot)
 * This is faster and simpler - returns 0-100 per category
 */
export function calculateQuickScore(issues: QuickIssues): QuickScores {
  const weights = {
    seo: { 
      noTitle: 15, 
      titleTooShort: 5, 
      titleTooLong: 3,
      noMetaDescription: 10, 
      multipleH1: 8, 
      imagesNoAlt: 5,
      noCanonical: 5,
      noOpenGraph: 3,
    },
    a11y: { 
      missingLang: 10, 
      buttonsNoLabel: 5, 
      linksNoText: 5,
      formInputsNoLabels: 8, 
      imagesNoAltA11y: 5,
    },
    perf: { 
      tooManyResources: 10, 
      largeDOM: 8, 
      noLazyLoading: 5,
      inlineStyles: 5,
      blockingScripts: 12,
    },
    sec: { 
      notHttps: 30, 
      mixedContent: 15, 
      noCSP: 10,
      inlineJavaScript: 8,
    },
  };

  // Start at 100, deduct points
  const scores: QuickScores = { 
    seo: 100, 
    a11y: 100, 
    perf: 100, 
    sec: 100,
    overall: 100,
  };
  
  for (const [category, checks] of Object.entries(issues)) {
    const categoryKey = category as keyof QuickIssues;
    
    for (const [check, value] of Object.entries(checks)) {
      const weight = (weights[categoryKey] as any)?.[check] || 0;
      
      // Handle boolean flags
      if (typeof value === 'boolean' && value) {
        scores[categoryKey] -= weight;
      }
      // Handle counts (e.g., number of images without alt)
      else if (typeof value === 'number' && value > 0) {
        // Deduct weight per occurrence, but cap the deduction
        const deduction = Math.min(value * weight, weight * 3);
        scores[categoryKey] -= deduction;
      }
    }
    
    // Ensure score stays within 0-100
    scores[categoryKey] = Math.max(0, Math.min(100, scores[categoryKey]));
  }
  
  // Calculate overall score (average of all categories)
  scores.overall = Math.round(
    (scores.seo + scores.a11y + scores.perf + scores.sec) / 4
  );
  
  return scores;
}