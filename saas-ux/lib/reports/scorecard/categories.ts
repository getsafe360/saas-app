// lib/reports/scorecard/categories.ts
// Performance Acceleration Scorecard - Category Definitions (A-J)

import type { CriterionScore } from '@/lib/db/schema/reports/performance-scorecard';

/**
 * Category definition with max points and criteria
 */
export interface CategoryDefinition {
  id: string;
  name: string;
  letter: string;
  maxPoints: number;
  criteria: CriterionDefinition[];
}

/**
 * Individual criterion definition
 */
export interface CriterionDefinition {
  id: string;
  name: string;
  maxPoints: number;
  lighthouseAudit?: string;        // Lighthouse audit ID
  alternativeSources?: string[];   // WebPageTest, CrUX, DevTools, RUM
  targetDescription: string;       // e.g., "≤2.5s at p75"
}

/**
 * Category A: Core Web Vitals (20 points)
 */
export const CORE_WEB_VITALS: CategoryDefinition = {
  id: 'coreWebVitals',
  name: 'Core Web Vitals KPIs',
  letter: 'A',
  maxPoints: 20,
  criteria: [
    {
      id: 'lcp',
      name: 'Largest Contentful Paint',
      maxPoints: 6,
      lighthouseAudit: 'largest-contentful-paint',
      alternativeSources: ['CrUX', 'WebPageTest', 'RUM'],
      targetDescription: '≤2.5s at 75th percentile',
    },
    {
      id: 'inp',
      name: 'Interaction to Next Paint',
      maxPoints: 6,
      lighthouseAudit: 'interaction-to-next-paint',
      alternativeSources: ['CrUX', 'RUM'],
      targetDescription: '≤200ms at 75th percentile',
    },
    {
      id: 'cls',
      name: 'Cumulative Layout Shift',
      maxPoints: 4,
      lighthouseAudit: 'cumulative-layout-shift',
      alternativeSources: ['CrUX', 'WebPageTest', 'RUM'],
      targetDescription: '≤0.1 at 75th percentile',
    },
    {
      id: 'stability',
      name: 'Performance Score Stability',
      maxPoints: 4,
      targetDescription: 'Consistent scores across deployments',
    },
  ],
};

/**
 * Category B: Images (14 points)
 */
export const IMAGES: CategoryDefinition = {
  id: 'images',
  name: 'Images',
  letter: 'B',
  maxPoints: 14,
  criteria: [
    {
      id: 'nextGenFormats',
      name: 'Next-gen Formats',
      maxPoints: 3,
      lighthouseAudit: 'modern-image-formats',
      targetDescription: 'Use WebP/AVIF for all images',
    },
    {
      id: 'compression',
      name: 'Efficient Compression',
      maxPoints: 3,
      lighthouseAudit: 'uses-optimized-images',
      targetDescription: 'Optimized encoding for all images',
    },
    {
      id: 'responsiveSizing',
      name: 'Responsive Sizing',
      maxPoints: 3,
      lighthouseAudit: 'uses-responsive-images',
      targetDescription: 'Use srcset for responsive images',
    },
    {
      id: 'lazyLoading',
      name: 'Lazy Loading',
      maxPoints: 3,
      lighthouseAudit: 'offscreen-images',
      targetDescription: 'Lazy-load offscreen images',
    },
    {
      id: 'lcpPriority',
      name: 'LCP Hero Priority',
      maxPoints: 2,
      lighthouseAudit: 'prioritize-lcp-image',
      targetDescription: 'Preload hero/LCP image',
    },
  ],
};

/**
 * Category C: CSS (10 points)
 */
export const CSS: CategoryDefinition = {
  id: 'css',
  name: 'CSS',
  letter: 'C',
  maxPoints: 10,
  criteria: [
    {
      id: 'unusedCss',
      name: 'Remove Unused CSS',
      maxPoints: 4,
      lighthouseAudit: 'unused-css-rules',
      targetDescription: 'Remove all unused CSS',
    },
    {
      id: 'minification',
      name: 'Minify CSS',
      maxPoints: 2,
      lighthouseAudit: 'unminified-css',
      targetDescription: 'Minify all CSS files',
    },
    {
      id: 'renderBlocking',
      name: 'Eliminate Render-blocking CSS',
      maxPoints: 4,
      lighthouseAudit: 'render-blocking-resources',
      targetDescription: 'No render-blocking CSS',
    },
  ],
};

/**
 * Category D: JavaScript (14 points)
 */
export const JAVASCRIPT: CategoryDefinition = {
  id: 'javascript',
  name: 'JavaScript',
  letter: 'D',
  maxPoints: 14,
  criteria: [
    {
      id: 'unusedJs',
      name: 'Remove Unused JS',
      maxPoints: 4,
      lighthouseAudit: 'unused-javascript',
      targetDescription: 'Remove all unused JavaScript',
    },
    {
      id: 'minification',
      name: 'Minify JS',
      maxPoints: 2,
      lighthouseAudit: 'unminified-javascript',
      targetDescription: 'Minify all JavaScript files',
    },
    {
      id: 'executionTime',
      name: 'Reduce Execution Time',
      maxPoints: 4,
      lighthouseAudit: 'bootup-time',
      targetDescription: 'Reduce JavaScript execution time',
    },
    {
      id: 'mainThreadWork',
      name: 'Minimize Main-thread Work',
      maxPoints: 2,
      lighthouseAudit: 'mainthread-work-breakdown',
      targetDescription: 'Minimize main-thread blocking',
    },
    {
      id: 'duplicateModules',
      name: 'Remove Duplicate Modules',
      maxPoints: 2,
      lighthouseAudit: 'duplicated-javascript',
      targetDescription: 'No duplicate JS modules',
    },
  ],
};

/**
 * Category E: Fonts (8 points)
 */
export const FONTS: CategoryDefinition = {
  id: 'fonts',
  name: 'Fonts',
  letter: 'E',
  maxPoints: 8,
  criteria: [
    {
      id: 'textVisibility',
      name: 'Text Visibility During Load',
      maxPoints: 3,
      lighthouseAudit: 'font-display',
      targetDescription: 'Ensure text visibility during font load',
    },
    {
      id: 'preloading',
      name: 'Preload Critical Fonts',
      maxPoints: 3,
      lighthouseAudit: 'preload-fonts',
      targetDescription: 'Preload fonts used above the fold',
    },
    {
      id: 'payloadReduction',
      name: 'Reduce Font Payload',
      maxPoints: 2,
      targetDescription: 'Subset fonts, use variable fonts',
    },
  ],
};

/**
 * Category F: Network & Compression (10 points)
 */
export const NETWORK: CategoryDefinition = {
  id: 'network',
  name: 'Network & Compression',
  letter: 'F',
  maxPoints: 10,
  criteria: [
    {
      id: 'textCompression',
      name: 'Text Compression',
      maxPoints: 4,
      lighthouseAudit: 'uses-text-compression',
      targetDescription: 'Enable Gzip/Brotli compression',
    },
    {
      id: 'http2',
      name: 'HTTP/2+ Support',
      maxPoints: 3,
      lighthouseAudit: 'uses-http2',
      targetDescription: 'Serve assets over HTTP/2+',
    },
    {
      id: 'redirects',
      name: 'Reduce Redirects',
      maxPoints: 1,
      lighthouseAudit: 'redirects',
      targetDescription: 'Minimize redirect chains',
    },
    {
      id: 'transferSize',
      name: 'Lean Transfer Sizes',
      maxPoints: 2,
      lighthouseAudit: 'total-byte-weight',
      targetDescription: 'Keep total transfer size minimal',
    },
  ],
};

/**
 * Category G: Caching (8 points)
 */
export const CACHING: CategoryDefinition = {
  id: 'caching',
  name: 'Caching',
  letter: 'G',
  maxPoints: 8,
  criteria: [
    {
      id: 'staticAssets',
      name: 'Static Asset Cache Policy',
      maxPoints: 5,
      lighthouseAudit: 'uses-long-cache-ttl',
      targetDescription: 'Long cache TTL for static assets',
    },
    {
      id: 'htmlAssetSplit',
      name: 'HTML/Asset Cache Split',
      maxPoints: 3,
      targetDescription: 'Separate cache policies for HTML vs assets',
    },
  ],
};

/**
 * Category H: Server/TTFB (8 points)
 */
export const SERVER: CategoryDefinition = {
  id: 'server',
  name: 'Server/TTFB',
  letter: 'H',
  maxPoints: 8,
  criteria: [
    {
      id: 'initialResponse',
      name: 'Reduce Initial Response Time',
      maxPoints: 6,
      lighthouseAudit: 'server-response-time',
      alternativeSources: ['WebPageTest', 'RUM'],
      targetDescription: 'TTFB < 600ms',
    },
    {
      id: 'cdnCaching',
      name: 'Server/CDN Cache Hit Ratio',
      maxPoints: 2,
      targetDescription: 'High CDN cache hit ratio (>90%)',
    },
  ],
};

/**
 * Category I: Third-Party Control (8 points)
 */
export const THIRD_PARTY: CategoryDefinition = {
  id: 'thirdParty',
  name: 'Third-Party Control',
  letter: 'I',
  maxPoints: 8,
  criteria: [
    {
      id: 'impactReduction',
      name: 'Reduce Third-party Impact',
      maxPoints: 4,
      lighthouseAudit: 'third-party-summary',
      targetDescription: 'Minimize third-party blocking time',
    },
    {
      id: 'facades',
      name: 'Lazy-load with Facades',
      maxPoints: 4,
      lighthouseAudit: 'third-party-facades',
      targetDescription: 'Use facades for third-party embeds',
    },
  ],
};

/**
 * Category J: DOM & Rendering (6 points)
 */
export const DOM_RENDERING: CategoryDefinition = {
  id: 'domRendering',
  name: 'DOM & Rendering',
  letter: 'J',
  maxPoints: 6,
  criteria: [
    {
      id: 'domSize',
      name: 'Avoid Excessive DOM Size',
      maxPoints: 3,
      lighthouseAudit: 'dom-size',
      targetDescription: 'DOM size < 1,500 elements',
    },
    {
      id: 'renderBlocking',
      name: 'Reduce Render-blocking Resources',
      maxPoints: 3,
      lighthouseAudit: 'render-blocking-resources',
      targetDescription: 'Minimize render-blocking resources',
    },
  ],
};

/**
 * All categories in order (A-J)
 */
export const ALL_CATEGORIES: CategoryDefinition[] = [
  CORE_WEB_VITALS,  // A: 20 pts
  IMAGES,           // B: 14 pts
  CSS,              // C: 10 pts
  JAVASCRIPT,       // D: 14 pts
  FONTS,            // E: 8 pts
  NETWORK,          // F: 10 pts
  CACHING,          // G: 8 pts
  SERVER,           // H: 8 pts
  THIRD_PARTY,      // I: 8 pts
  DOM_RENDERING,    // J: 6 pts
];

/**
 * Total possible points (should be 100)
 */
export const TOTAL_MAX_POINTS = ALL_CATEGORIES.reduce((sum, cat) => sum + cat.maxPoints, 0);

/**
 * Get category by ID
 */
export function getCategoryById(id: string): CategoryDefinition | undefined {
  return ALL_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category by letter
 */
export function getCategoryByLetter(letter: string): CategoryDefinition | undefined {
  return ALL_CATEGORIES.find((cat) => cat.letter === letter.toUpperCase());
}

/**
 * Get criterion definition by ID within a category
 */
export function getCriterionById(
  categoryId: string,
  criterionId: string
): CriterionDefinition | undefined {
  const category = getCategoryById(categoryId);
  return category?.criteria.find((c) => c.id === criterionId);
}
