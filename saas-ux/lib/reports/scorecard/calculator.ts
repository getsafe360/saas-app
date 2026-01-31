// lib/reports/scorecard/calculator.ts
// Performance Acceleration Scorecard Calculator

import type {
  PerformanceScorecardData,
  CriterionScore,
  CoreWebVitalsScore,
  ImagesScore,
  CssScore,
  JavaScriptScore,
  FontsScore,
  NetworkScore,
  CachingScore,
  ServerScore,
  ThirdPartyScore,
  DomRenderingScore,
  PriorityAction,
} from '@/lib/db/schema/reports/performance-scorecard';

import {
  ALL_CATEGORIES,
  TOTAL_MAX_POINTS,
  type CategoryDefinition,
  type CriterionDefinition,
} from './categories';

/**
 * Lighthouse audit result structure
 */
interface LighthouseAudit {
  id: string;
  score: number | null;      // 0-1 or null if not applicable
  numericValue?: number;     // Raw value (e.g., ms, bytes)
  displayValue?: string;     // Formatted display value
  details?: {
    items?: Array<Record<string, unknown>>;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
}

/**
 * Input data for scorecard calculation
 */
export interface ScorecardInput {
  device: 'mobile' | 'desktop';
  lighthouseAudits: Record<string, LighthouseAudit>;
  fieldData?: {
    lcp: { p75: number };
    inp: { p75: number };
    cls: { p75: number };
  };
}

/**
 * Score a single criterion based on Lighthouse audit
 */
function scoreCriterion(
  def: CriterionDefinition,
  audits: Record<string, LighthouseAudit>
): CriterionScore {
  const audit = def.lighthouseAudit ? audits[def.lighthouseAudit] : null;

  let score = 0;
  let status: 'pass' | 'partial' | 'fail' = 'fail';
  let currentValue: string | undefined;
  let targetValue = def.targetDescription;

  if (audit) {
    currentValue = audit.displayValue;

    if (audit.score !== null) {
      if (audit.score >= 0.9) {
        score = def.maxPoints;
        status = 'pass';
      } else if (audit.score >= 0.5) {
        score = Math.round(def.maxPoints * 0.5);
        status = 'partial';
      } else {
        score = 0;
        status = 'fail';
      }
    }
  }

  return {
    id: def.id,
    name: def.name,
    maxPoints: def.maxPoints,
    score,
    status,
    currentValue,
    targetValue,
  };
}

/**
 * Calculate Core Web Vitals (Category A) - 20 points
 */
function calculateCoreWebVitals(
  audits: Record<string, LighthouseAudit>,
  fieldData?: ScorecardInput['fieldData']
): CoreWebVitalsScore {
  // LCP scoring
  const lcpAudit = audits['largest-contentful-paint'];
  let lcpScore = 0;
  let lcpStatus: 'pass' | 'partial' | 'fail' = 'fail';
  const lcpValue = fieldData?.lcp.p75 ?? lcpAudit?.numericValue;

  if (lcpValue) {
    if (lcpValue <= 2500) {
      lcpScore = 6;
      lcpStatus = 'pass';
    } else if (lcpValue <= 4000) {
      lcpScore = 3;
      lcpStatus = 'partial';
    }
  }

  // INP scoring
  const inpAudit = audits['interaction-to-next-paint'];
  let inpScore = 0;
  let inpStatus: 'pass' | 'partial' | 'fail' = 'fail';
  const inpValue = fieldData?.inp.p75 ?? inpAudit?.numericValue;

  if (inpValue !== undefined) {
    if (inpValue <= 200) {
      inpScore = 6;
      inpStatus = 'pass';
    } else if (inpValue <= 500) {
      inpScore = 3;
      inpStatus = 'partial';
    }
  }

  // CLS scoring
  const clsAudit = audits['cumulative-layout-shift'];
  let clsScore = 0;
  let clsStatus: 'pass' | 'partial' | 'fail' = 'fail';
  const clsValue = fieldData?.cls.p75 ?? clsAudit?.numericValue;

  if (clsValue !== undefined) {
    if (clsValue <= 0.1) {
      clsScore = 4;
      clsStatus = 'pass';
    } else if (clsValue <= 0.25) {
      clsScore = 2;
      clsStatus = 'partial';
    }
  }

  // Stability scoring (placeholder - would need historical data)
  const stabilityScore = 2; // Default to partial

  return {
    lcp: {
      id: 'lcp',
      name: 'Largest Contentful Paint',
      maxPoints: 6,
      score: lcpScore,
      status: lcpStatus,
      currentValue: lcpValue ? `${(lcpValue / 1000).toFixed(1)}s` : undefined,
      targetValue: '≤2.5s at p75',
    },
    inp: {
      id: 'inp',
      name: 'Interaction to Next Paint',
      maxPoints: 6,
      score: inpScore,
      status: inpStatus,
      currentValue: inpValue ? `${inpValue}ms` : undefined,
      targetValue: '≤200ms at p75',
    },
    cls: {
      id: 'cls',
      name: 'Cumulative Layout Shift',
      maxPoints: 4,
      score: clsScore,
      status: clsStatus,
      currentValue: clsValue?.toFixed(3),
      targetValue: '≤0.1 at p75',
    },
    stability: {
      id: 'stability',
      name: 'Performance Score Stability',
      maxPoints: 4,
      score: stabilityScore,
      status: 'partial',
      targetValue: 'Consistent scores across deployments',
    },
    total: lcpScore + inpScore + clsScore + stabilityScore,
  };
}

/**
 * Calculate Images (Category B) - 14 points
 */
function calculateImages(audits: Record<string, LighthouseAudit>): ImagesScore {
  const criteria = ALL_CATEGORIES[1].criteria;

  const nextGenFormats = scoreCriterion(criteria[0], audits);
  const compression = scoreCriterion(criteria[1], audits);
  const responsiveSizing = scoreCriterion(criteria[2], audits);
  const lazyLoading = scoreCriterion(criteria[3], audits);
  const lcpPriority = scoreCriterion(criteria[4], audits);

  return {
    nextGenFormats,
    compression,
    responsiveSizing,
    lazyLoading,
    lcpPriority,
    total:
      nextGenFormats.score +
      compression.score +
      responsiveSizing.score +
      lazyLoading.score +
      lcpPriority.score,
  };
}

/**
 * Calculate CSS (Category C) - 10 points
 */
function calculateCss(audits: Record<string, LighthouseAudit>): CssScore {
  const criteria = ALL_CATEGORIES[2].criteria;

  const unusedCss = scoreCriterion(criteria[0], audits);
  const minification = scoreCriterion(criteria[1], audits);
  const renderBlocking = scoreCriterion(criteria[2], audits);

  return {
    unusedCss,
    minification,
    renderBlocking,
    total: unusedCss.score + minification.score + renderBlocking.score,
  };
}

/**
 * Calculate JavaScript (Category D) - 14 points
 */
function calculateJavaScript(audits: Record<string, LighthouseAudit>): JavaScriptScore {
  const criteria = ALL_CATEGORIES[3].criteria;

  const unusedJs = scoreCriterion(criteria[0], audits);
  const minification = scoreCriterion(criteria[1], audits);
  const executionTime = scoreCriterion(criteria[2], audits);
  const mainThreadWork = scoreCriterion(criteria[3], audits);
  const duplicateModules = scoreCriterion(criteria[4], audits);

  return {
    unusedJs,
    minification,
    executionTime,
    mainThreadWork,
    duplicateModules,
    total:
      unusedJs.score +
      minification.score +
      executionTime.score +
      mainThreadWork.score +
      duplicateModules.score,
  };
}

/**
 * Calculate Fonts (Category E) - 8 points
 */
function calculateFonts(audits: Record<string, LighthouseAudit>): FontsScore {
  const criteria = ALL_CATEGORIES[4].criteria;

  const textVisibility = scoreCriterion(criteria[0], audits);
  const preloading = scoreCriterion(criteria[1], audits);

  // Payload reduction doesn't have a direct Lighthouse audit
  const payloadReduction: CriterionScore = {
    id: 'payloadReduction',
    name: 'Reduce Font Payload',
    maxPoints: 2,
    score: 1, // Default to partial
    status: 'partial',
    targetValue: 'Subset fonts, use variable fonts',
  };

  return {
    textVisibility,
    preloading,
    payloadReduction,
    total: textVisibility.score + preloading.score + payloadReduction.score,
  };
}

/**
 * Calculate Network (Category F) - 10 points
 */
function calculateNetwork(audits: Record<string, LighthouseAudit>): NetworkScore {
  const criteria = ALL_CATEGORIES[5].criteria;

  const textCompression = scoreCriterion(criteria[0], audits);
  const http2 = scoreCriterion(criteria[1], audits);
  const redirects = scoreCriterion(criteria[2], audits);
  const transferSize = scoreCriterion(criteria[3], audits);

  return {
    textCompression,
    http2,
    redirects,
    transferSize,
    total:
      textCompression.score + http2.score + redirects.score + transferSize.score,
  };
}

/**
 * Calculate Caching (Category G) - 8 points
 */
function calculateCaching(audits: Record<string, LighthouseAudit>): CachingScore {
  const criteria = ALL_CATEGORIES[6].criteria;

  const staticAssets = scoreCriterion(criteria[0], audits);

  // HTML/Asset split doesn't have a direct Lighthouse audit
  const htmlAssetSplit: CriterionScore = {
    id: 'htmlAssetSplit',
    name: 'HTML/Asset Cache Split',
    maxPoints: 3,
    score: 1.5, // Default to partial
    status: 'partial',
    targetValue: 'Separate cache policies for HTML vs assets',
  };

  return {
    staticAssets,
    htmlAssetSplit,
    total: staticAssets.score + htmlAssetSplit.score,
  };
}

/**
 * Calculate Server (Category H) - 8 points
 */
function calculateServer(audits: Record<string, LighthouseAudit>): ServerScore {
  const criteria = ALL_CATEGORIES[7].criteria;

  const initialResponse = scoreCriterion(criteria[0], audits);

  // CDN caching doesn't have a direct Lighthouse audit
  const cdnCaching: CriterionScore = {
    id: 'cdnCaching',
    name: 'Server/CDN Cache Hit Ratio',
    maxPoints: 2,
    score: 1, // Default to partial
    status: 'partial',
    targetValue: 'High CDN cache hit ratio (>90%)',
  };

  return {
    initialResponse,
    cdnCaching,
    total: initialResponse.score + cdnCaching.score,
  };
}

/**
 * Calculate Third-Party (Category I) - 8 points
 */
function calculateThirdParty(audits: Record<string, LighthouseAudit>): ThirdPartyScore {
  const criteria = ALL_CATEGORIES[8].criteria;

  const impactReduction = scoreCriterion(criteria[0], audits);
  const facades = scoreCriterion(criteria[1], audits);

  return {
    impactReduction,
    facades,
    total: impactReduction.score + facades.score,
  };
}

/**
 * Calculate DOM & Rendering (Category J) - 6 points
 */
function calculateDomRendering(audits: Record<string, LighthouseAudit>): DomRenderingScore {
  const criteria = ALL_CATEGORIES[9].criteria;

  const domSize = scoreCriterion(criteria[0], audits);
  const renderBlocking = scoreCriterion(criteria[1], audits);

  return {
    domSize,
    renderBlocking,
    total: domSize.score + renderBlocking.score,
  };
}

/**
 * Determine grade from score
 */
function calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * Generate priority actions based on failed/partial criteria
 */
function generatePriorityActions(
  scorecard: Omit<PerformanceScorecardData, 'priorityActions' | 'totalScore' | 'grade'>
): PriorityAction[] {
  const actions: PriorityAction[] = [];

  // Helper to add action from criterion
  const addAction = (
    category: string,
    criterion: CriterionScore,
    estimatedImpact: PriorityAction['estimatedImpact'],
    effort: PriorityAction['effort']
  ) => {
    if (criterion.status !== 'pass') {
      actions.push({
        category,
        action: `${criterion.name}: ${criterion.targetValue}`,
        estimatedImpact,
        effort,
        priority: 0, // Will be set later
      });
    }
  };

  // Core Web Vitals (high impact)
  addAction('coreWebVitals', scorecard.coreWebVitals.lcp, { ms: 1000 }, 'medium');
  addAction('coreWebVitals', scorecard.coreWebVitals.inp, { ms: 100 }, 'high');
  addAction('coreWebVitals', scorecard.coreWebVitals.cls, {}, 'medium');

  // Images (high impact, often low effort)
  addAction('images', scorecard.images.nextGenFormats, { kb: 500 }, 'low');
  addAction('images', scorecard.images.compression, { kb: 300 }, 'low');
  addAction('images', scorecard.images.lazyLoading, { ms: 500 }, 'low');

  // JavaScript (high impact)
  addAction('javascript', scorecard.javascript.unusedJs, { kb: 200, ms: 300 }, 'medium');
  addAction('javascript', scorecard.javascript.executionTime, { ms: 500 }, 'high');

  // CSS
  addAction('css', scorecard.css.unusedCss, { kb: 50 }, 'medium');
  addAction('css', scorecard.css.renderBlocking, { ms: 200 }, 'medium');

  // Network
  addAction('network', scorecard.network.textCompression, { kb: 400 }, 'low');

  // Server
  addAction('server', scorecard.server.initialResponse, { ms: 400 }, 'high');

  // Sort by estimated impact and take top 5
  actions.sort((a, b) => {
    const aImpact = (a.estimatedImpact.ms || 0) + (a.estimatedImpact.kb || 0) / 10;
    const bImpact = (b.estimatedImpact.ms || 0) + (b.estimatedImpact.kb || 0) / 10;
    return bImpact - aImpact;
  });

  // Assign priorities
  return actions.slice(0, 5).map((action, index) => ({
    ...action,
    priority: index + 1,
  }));
}

/**
 * Calculate complete Performance Acceleration Scorecard
 */
export function calculateScorecard(input: ScorecardInput): PerformanceScorecardData {
  const { device, lighthouseAudits, fieldData } = input;

  // Calculate each category
  const coreWebVitals = calculateCoreWebVitals(lighthouseAudits, fieldData);
  const images = calculateImages(lighthouseAudits);
  const css = calculateCss(lighthouseAudits);
  const javascript = calculateJavaScript(lighthouseAudits);
  const fonts = calculateFonts(lighthouseAudits);
  const network = calculateNetwork(lighthouseAudits);
  const caching = calculateCaching(lighthouseAudits);
  const server = calculateServer(lighthouseAudits);
  const thirdParty = calculateThirdParty(lighthouseAudits);
  const domRendering = calculateDomRendering(lighthouseAudits);

  // Calculate total score
  const totalScore = Math.round(
    coreWebVitals.total +
    images.total +
    css.total +
    javascript.total +
    fonts.total +
    network.total +
    caching.total +
    server.total +
    thirdParty.total +
    domRendering.total
  );

  const grade = calculateGrade(totalScore);

  // Build partial scorecard for priority action generation
  const partialScorecard = {
    version: 1,
    device,
    coreWebVitals,
    images,
    css,
    javascript,
    fonts,
    network,
    caching,
    server,
    thirdParty,
    domRendering,
  };

  const priorityActions = generatePriorityActions(partialScorecard);

  // Build field data if available
  const fieldDataOutput = fieldData
    ? {
        source: 'crux' as const,
        lcp: {
          p75: fieldData.lcp.p75,
          rating:
            fieldData.lcp.p75 <= 2500
              ? ('good' as const)
              : fieldData.lcp.p75 <= 4000
                ? ('needs-improvement' as const)
                : ('poor' as const),
        },
        inp: {
          p75: fieldData.inp.p75,
          rating:
            fieldData.inp.p75 <= 200
              ? ('good' as const)
              : fieldData.inp.p75 <= 500
                ? ('needs-improvement' as const)
                : ('poor' as const),
        },
        cls: {
          p75: fieldData.cls.p75,
          rating:
            fieldData.cls.p75 <= 0.1
              ? ('good' as const)
              : fieldData.cls.p75 <= 0.25
                ? ('needs-improvement' as const)
                : ('poor' as const),
        },
      }
    : undefined;

  return {
    ...partialScorecard,
    totalScore,
    grade,
    priorityActions,
    fieldData: fieldDataOutput,
  };
}

/**
 * Get scorecard summary for display
 */
export function getScorecardSummary(scorecard: PerformanceScorecardData): {
  totalScore: number;
  maxScore: number;
  grade: string;
  categoryBreakdown: Array<{
    letter: string;
    name: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
} {
  return {
    totalScore: scorecard.totalScore,
    maxScore: TOTAL_MAX_POINTS,
    grade: scorecard.grade,
    categoryBreakdown: [
      { letter: 'A', name: 'Core Web Vitals', score: scorecard.coreWebVitals.total, maxScore: 20, percentage: (scorecard.coreWebVitals.total / 20) * 100 },
      { letter: 'B', name: 'Images', score: scorecard.images.total, maxScore: 14, percentage: (scorecard.images.total / 14) * 100 },
      { letter: 'C', name: 'CSS', score: scorecard.css.total, maxScore: 10, percentage: (scorecard.css.total / 10) * 100 },
      { letter: 'D', name: 'JavaScript', score: scorecard.javascript.total, maxScore: 14, percentage: (scorecard.javascript.total / 14) * 100 },
      { letter: 'E', name: 'Fonts', score: scorecard.fonts.total, maxScore: 8, percentage: (scorecard.fonts.total / 8) * 100 },
      { letter: 'F', name: 'Network', score: scorecard.network.total, maxScore: 10, percentage: (scorecard.network.total / 10) * 100 },
      { letter: 'G', name: 'Caching', score: scorecard.caching.total, maxScore: 8, percentage: (scorecard.caching.total / 8) * 100 },
      { letter: 'H', name: 'Server/TTFB', score: scorecard.server.total, maxScore: 8, percentage: (scorecard.server.total / 8) * 100 },
      { letter: 'I', name: 'Third-Party', score: scorecard.thirdParty.total, maxScore: 8, percentage: (scorecard.thirdParty.total / 8) * 100 },
      { letter: 'J', name: 'DOM & Rendering', score: scorecard.domRendering.total, maxScore: 6, percentage: (scorecard.domRendering.total / 6) * 100 },
    ],
  };
}
