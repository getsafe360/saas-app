// components/site-cockpit/cards/optimization/utils/calculations.ts

import type { 
  PerformanceMetrics, 
  OptimizationComparison, 
  Savings,
  QuickWin,
  OptimizationType 
} from "../types";

/**
 * Calculate potential performance improvements
 */
export function calculatePotentialImprovements(
  current: PerformanceMetrics,
  optimizations: OptimizationType[]
): PerformanceMetrics {
  let potential = { ...current };

  // Image optimization: 60-70% reduction
  if (optimizations.includes("images")) {
    potential.pageWeight *= 0.35;
  }

  // Caching: 30% faster load time for repeat visits
  if (optimizations.includes("caching")) {
    potential.loadTime *= 0.7;
  }

  // Compression: 40-50% reduction
  if (optimizations.includes("compression")) {
    potential.pageWeight *= 0.55;
  }

  // Minification: 30-50% reduction for CSS/JS
  if (optimizations.includes("minification")) {
    potential.pageWeight *= 0.65;
    potential.requests *= 0.8; // Combined files
  }

  // Lazy loading: 20-30% reduction in initial load
  if (optimizations.includes("lazy-loading")) {
    potential.loadTime *= 0.75;
    potential.requests *= 0.7;
  }

  // Security headers: minimal performance impact
  if (optimizations.includes("security-headers")) {
    potential.score += 10;
  }

  // CDN: 40-60% faster load time
  if (optimizations.includes("cdn")) {
    potential.loadTime *= 0.5;
    potential.ttfb *= 0.4;
  }

  // Database optimization: 20-30% faster
  if (optimizations.includes("database")) {
    potential.loadTime *= 0.75;
  }

  // Update score based on improvements
  potential.score = calculateScore(potential);
  potential.grade = getGrade(potential.score);

  return potential;
}

/**
 * Calculate savings between before and after
 */
export function calculateSavings(
  before: PerformanceMetrics,
  after: PerformanceMetrics,
  monthlyVisits: number = 10000
): Savings {
  const weightSaved = before.pageWeight - after.pageWeight;
  const requestsSaved = before.requests - after.requests;
  const timeSaved = before.loadTime - after.loadTime;

  // Calculate monthly bandwidth savings
  const monthlyBandwidthBytes = weightSaved * monthlyVisits;
  const monthlyBandwidthGB = monthlyBandwidthBytes / (1024 * 1024 * 1024);

  return {
    pageWeight: {
      absolute: weightSaved,
      percentage: (weightSaved / before.pageWeight) * 100,
      display: formatBytes(weightSaved),
    },
    requests: {
      absolute: requestsSaved,
      percentage: (requestsSaved / before.requests) * 100,
    },
    loadTime: {
      absolute: timeSaved,
      percentage: (timeSaved / before.loadTime) * 100,
      display: `${timeSaved.toFixed(1)}s`,
    },
    bandwidth: {
      monthly: `${monthlyBandwidthGB.toFixed(1)} GB/month`,
      cost: estimateBandwidthCost(monthlyBandwidthGB),
    },
  };
}

/**
 * Generate quick wins based on current state
 */
export function generateQuickWins(
  current: PerformanceMetrics,
  hasImages: boolean = true,
  hasCaching: boolean = false,
  hasCompression: boolean = false,
  hasMinification: boolean = false
): QuickWin[] {
  const quickWins: QuickWin[] = [];

  // Image Optimization
  if (hasImages) {
    const imageBytes = current.pageWeight * 0.4; // Assume 40% is images
    const optimizedBytes = imageBytes * 0.3; // 70% reduction
    
    quickWins.push({
      id: "images",
      type: "images",
      title: "Optimize Images",
      description: "Convert to WebP, resize, and compress all images",
      impact: "high",
      effort: "easy",
      current: {
        value: formatBytes(imageBytes),
        size: imageBytes,
      },
      optimized: {
        value: formatBytes(optimizedBytes),
        size: optimizedBytes,
      },
      savings: {
        percentage: 70,
        absolute: formatBytes(imageBytes - optimizedBytes),
        timeImpact: "0.8s faster",
      },
      status: "pending",
      requiresBackup: true,
      risks: ["Image quality may change", "File paths updated"],
      estimatedTime: 30,
      compatibility: {
        wordpress: true,
        static: true,
      },
    });
  }

  // Browser Caching
  if (!hasCaching) {
    quickWins.push({
      id: "caching",
      type: "caching",
      title: "Enable Browser Caching",
      description: "Set cache headers for static assets",
      impact: "high",
      effort: "easy",
      current: {
        value: "Disabled",
        metric: "cache-control",
      },
      optimized: {
        value: "1 year for static assets",
        metric: "cache-control",
      },
      savings: {
        percentage: 70,
        absolute: formatBytes(current.pageWeight * 0.7),
        timeImpact: "70% faster repeat visits",
      },
      status: "pending",
      requiresBackup: true,
      risks: ["May require .htaccess changes"],
      estimatedTime: 5,
      compatibility: {
        wordpress: true,
        static: true,
        requiresFTP: true,
      },
    });
  }

  // Compression
  if (!hasCompression) {
    const compressionSavings = current.pageWeight * 0.5;
    
    quickWins.push({
      id: "compression",
      type: "compression",
      title: "Enable Gzip/Brotli Compression",
      description: "Compress text-based assets before sending",
      impact: "high",
      effort: "easy",
      current: {
        value: "Disabled",
      },
      optimized: {
        value: "Brotli enabled",
      },
      savings: {
        percentage: 50,
        absolute: formatBytes(compressionSavings),
        timeImpact: "0.5s faster",
      },
      status: "pending",
      requiresBackup: true,
      risks: ["Server configuration required"],
      estimatedTime: 10,
      compatibility: {
        wordpress: true,
        static: true,
        requiresSSH: true,
      },
    });
  }

  // CSS/JS Minification
  if (!hasMinification) {
    const assetBytes = current.pageWeight * 0.35; // CSS + JS
    const minifiedBytes = assetBytes * 0.5;
    
    quickWins.push({
      id: "minification",
      type: "minification",
      title: "Minify CSS & JavaScript",
      description: "Remove whitespace and combine files",
      impact: "medium",
      effort: "easy",
      current: {
        value: formatBytes(assetBytes),
        size: assetBytes,
      },
      optimized: {
        value: formatBytes(minifiedBytes),
        size: minifiedBytes,
      },
      savings: {
        percentage: 50,
        absolute: formatBytes(assetBytes - minifiedBytes),
        timeImpact: "0.4s faster",
      },
      status: "pending",
      requiresBackup: true,
      risks: ["May break inline scripts"],
      estimatedTime: 20,
      compatibility: {
        wordpress: true,
        static: true,
      },
    });
  }

  // Security Headers
  quickWins.push({
    id: "security-headers",
    type: "security-headers",
    title: "Add Security Headers",
    description: "Enable CSP, HSTS, X-Frame-Options, etc.",
    impact: "medium",
    effort: "easy",
    current: {
      value: "0/6 headers",
      metric: "security-headers",
    },
    optimized: {
      value: "6/6 headers",
      metric: "security-headers",
    },
    savings: {
      percentage: 0,
      absolute: "Security Score +45",
      timeImpact: "No performance impact",
    },
    status: "pending",
    requiresBackup: true,
    risks: ["May break embedded content"],
    estimatedTime: 5,
    compatibility: {
      wordpress: true,
      static: true,
      requiresFTP: true,
    },
  });

  // Lazy Loading
  quickWins.push({
    id: "lazy-loading",
    type: "lazy-loading",
    title: "Enable Lazy Loading",
    description: "Load images only when visible",
    impact: "medium",
    effort: "easy",
    current: {
      value: "Disabled",
    },
    optimized: {
      value: "Enabled for images",
    },
    savings: {
      percentage: 30,
      absolute: formatBytes(current.pageWeight * 0.3),
      timeImpact: "0.6s faster initial load",
    },
    status: "pending",
    requiresBackup: false,
    risks: ["SEO considerations for above-fold"],
    estimatedTime: 10,
    compatibility: {
      wordpress: true,
      static: true,
    },
  });

  return quickWins;
}

/**
 * Calculate performance score (0-100)
 */
export function calculateScore(metrics: PerformanceMetrics): number {
  let score = 100;

  // Page weight penalty (>500KB = bad)
  if (metrics.pageWeight > 500000) score -= 20;
  else if (metrics.pageWeight > 200000) score -= 10;

  // Request count penalty (>100 = bad)
  if (metrics.requests > 100) score -= 15;
  else if (metrics.requests > 50) score -= 5;

  // Load time penalty (>3s = bad)
  if (metrics.loadTime > 3) score -= 25;
  else if (metrics.loadTime > 2) score -= 15;
  else if (metrics.loadTime > 1) score -= 5;

  // TTFB penalty (>1s = bad)
  if (metrics.ttfb > 1) score -= 10;
  else if (metrics.ttfb > 0.5) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get letter grade from score
 */
export function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Format bytes to human-readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Estimate bandwidth cost (rough estimate)
 */
function estimateBandwidthCost(gbPerMonth: number): string {
  // Average cost: $0.05-0.10 per GB
  const costPerGB = 0.075;
  const monthlyCost = gbPerMonth * costPerGB;
  
  return `~$${monthlyCost.toFixed(2)}/month`;
}

/**
 * Sort quick wins by impact and effort
 */
export function sortQuickWins(quickWins: QuickWin[]): QuickWin[] {
  const impactWeight = { high: 3, medium: 2, low: 1 };
  const effortWeight = { easy: 3, moderate: 2, complex: 1 };

  return [...quickWins].sort((a, b) => {
    const scoreA = impactWeight[a.impact] * effortWeight[a.effort];
    const scoreB = impactWeight[b.impact] * effortWeight[b.effort];
    return scoreB - scoreA;
  });
}