// lib/db/schema/reports/performance-scorecard.ts
// 100-point Performance Acceleration Scorecard tracking

import {
  pgTable, uuid, integer, real, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';

/**
 * Individual criterion score (within a category)
 */
export interface CriterionScore {
  id: string;
  name: string;
  maxPoints: number;
  score: number;           // 0 = incomplete, half = partial, full = complete
  status: 'pass' | 'partial' | 'fail';
  currentValue?: string;   // e.g., "3.2s" for LCP
  targetValue?: string;    // e.g., "≤2.5s" for LCP
  notes?: string;
}

/**
 * Category A: Core Web Vitals (20 points)
 */
export interface CoreWebVitalsScore {
  lcp: CriterionScore;                    // 6 pts - LCP ≤ 2.5s at p75
  inp: CriterionScore;                    // 6 pts - INP ≤ 200ms at p75
  cls: CriterionScore;                    // 4 pts - CLS ≤ 0.1 at p75
  stability: CriterionScore;              // 4 pts - Score stability across deployments
  total: number;
}

/**
 * Category B: Images (14 points)
 */
export interface ImagesScore {
  nextGenFormats: CriterionScore;         // 3 pts - WebP/AVIF
  compression: CriterionScore;            // 3 pts - Efficient encoding
  responsiveSizing: CriterionScore;       // 3 pts - srcset usage
  lazyLoading: CriterionScore;            // 3 pts - Lazy-load offscreen
  lcpPriority: CriterionScore;            // 2 pts - Hero image preload
  total: number;
}

/**
 * Category C: CSS (10 points)
 */
export interface CssScore {
  unusedCss: CriterionScore;              // 4 pts - Remove unused CSS
  minification: CriterionScore;           // 2 pts - Minify CSS
  renderBlocking: CriterionScore;         // 4 pts - Eliminate render-blocking
  total: number;
}

/**
 * Category D: JavaScript (14 points)
 */
export interface JavaScriptScore {
  unusedJs: CriterionScore;               // 4 pts - Remove unused JS
  minification: CriterionScore;           // 2 pts - Minify JS
  executionTime: CriterionScore;          // 4 pts - Reduce execution time
  mainThreadWork: CriterionScore;         // 2 pts - Minimize main-thread work
  duplicateModules: CriterionScore;       // 2 pts - Remove duplicates
  total: number;
}

/**
 * Category E: Fonts (8 points)
 */
export interface FontsScore {
  textVisibility: CriterionScore;         // 3 pts - Text visible during load
  preloading: CriterionScore;             // 3 pts - Preload critical fonts
  payloadReduction: CriterionScore;       // 2 pts - Reduce font payload
  total: number;
}

/**
 * Category F: Network & Compression (10 points)
 */
export interface NetworkScore {
  textCompression: CriterionScore;        // 4 pts - Gzip/Brotli
  http2: CriterionScore;                  // 3 pts - HTTP/2+ support
  redirects: CriterionScore;              // 1 pt - Reduce redirects
  transferSize: CriterionScore;           // 2 pts - Lean requests
  total: number;
}

/**
 * Category G: Caching (8 points)
 */
export interface CachingScore {
  staticAssets: CriterionScore;           // 5 pts - Efficient cache policy
  htmlAssetSplit: CriterionScore;         // 3 pts - Proper cache splits
  total: number;
}

/**
 * Category H: Server/TTFB (8 points)
 */
export interface ServerScore {
  initialResponse: CriterionScore;        // 6 pts - Reduce TTFB
  cdnCaching: CriterionScore;             // 2 pts - Server/CDN hit ratios
  total: number;
}

/**
 * Category I: Third-Party Control (8 points)
 */
export interface ThirdPartyScore {
  impactReduction: CriterionScore;        // 4 pts - Reduce third-party impact
  facades: CriterionScore;                // 4 pts - Lazy-load with facades
  total: number;
}

/**
 * Category J: DOM & Rendering (6 points)
 */
export interface DomRenderingScore {
  domSize: CriterionScore;                // 3 pts - Avoid excessive DOM
  renderBlocking: CriterionScore;         // 3 pts - Reduce blocking resources
  total: number;
}

/**
 * Priority action item
 */
export interface PriorityAction {
  category: string;                       // e.g., "images"
  action: string;                         // e.g., "Convert images to WebP format"
  estimatedImpact: {
    ms?: number;                          // Milliseconds saved
    kb?: number;                          // Kilobytes saved
    requests?: number;                    // Requests reduced
  };
  effort: 'low' | 'medium' | 'high';
  priority: number;                       // 1 = highest
}

/**
 * Complete scorecard data
 */
export interface PerformanceScorecardData {
  version: number;                        // Schema version for migrations

  // Device context
  device: 'mobile' | 'desktop';

  // 10 category scores
  coreWebVitals: CoreWebVitalsScore;      // A: 20 pts
  images: ImagesScore;                    // B: 14 pts
  css: CssScore;                          // C: 10 pts
  javascript: JavaScriptScore;            // D: 14 pts
  fonts: FontsScore;                      // E: 8 pts
  network: NetworkScore;                  // F: 10 pts
  caching: CachingScore;                  // G: 8 pts
  server: ServerScore;                    // H: 8 pts
  thirdParty: ThirdPartyScore;            // I: 8 pts
  domRendering: DomRenderingScore;        // J: 6 pts

  // Total score
  totalScore: number;                     // Out of 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  // Top 5 priority actions
  priorityActions: PriorityAction[];

  // Field data (if available)
  fieldData?: {
    source: 'crux' | 'rum';
    lcp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' };
    inp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' };
  };
}

/**
 * Performance Scorecard Table
 *
 * Stores the 100-point Performance Acceleration Scorecard for each site scan.
 */
export const performanceScorecards = pgTable('performance_scorecards', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Site reference
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),

  // Scorecard data
  scorecard: jsonb('scorecard').$type<PerformanceScorecardData>().notNull(),

  // Denormalized for quick queries
  totalScore: real('total_score').notNull(),
  grade: integer('grade').notNull(),              // 0=F, 1=D, 2=C, 3=B, 4=A, 5=A+

  // Device type
  device: integer('device').notNull().default(0), // 0=mobile, 1=desktop

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  siteIdx: index('performance_scorecards_site_idx').on(table.siteId),
  scoreIdx: index('performance_scorecards_score_idx').on(table.totalScore),
  createdIdx: index('performance_scorecards_created_idx').on(table.createdAt),
}));

// Type exports
export type PerformanceScorecard = typeof performanceScorecards.$inferSelect;
export type NewPerformanceScorecard = typeof performanceScorecards.$inferInsert;
