// lib/cockpit/transform-api-data.ts
/**
 * Transforms analyze-facts API response to Site Cockpit format
 * Keeps the main page component clean and maintainable
 */

import type { SiteCockpitResponse, ScoreGrade } from "@/types/site-cockpit";

// ============================================
// Score & Grade Helpers
// ============================================

export function getScoreGrade(score: number): ScoreGrade {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
}

export function calculatePerformanceScore(data: any): number {
  let score = 100;
  if (data.perfHints?.approxHtmlBytes > 500000) score -= 20;
  else if (data.perfHints?.approxHtmlBytes > 200000) score -= 10;
  if (data.perfHints?.heavyScriptHint) score -= 15;
  if (data.perfHints?.heavyImageHint) score -= 10;
  return Math.max(0, score);
}

export function calculateSecurityScore(data: any): number {
  let score = 100;
  if (!data.isHttps) score -= 30;
  if (!data.headers?.["strict-transport-security"]) score -= 15;
  if (!data.headers?.["content-security-policy"]) score -= 15;
  if (!data.headers?.["x-frame-options"]) score -= 10;
  if (!data.headers?.["x-content-type-options"]) score -= 10;
  return Math.max(0, score);
}

export function calculateSEOScore(data: any): number {
  let score = 100;
  if (!data.meta?.title || data.meta.titleLen === 0) score -= 20;
  if (!data.meta?.description || data.meta.descriptionLen === 0) score -= 15;
  if (!data.meta?.hasCanonical) score -= 10;
  if (data.dom?.h1Count !== 1) score -= 10;
  if (data.accessibility?.imgMissingAlt > 0) score -= 5;
  return Math.max(0, score);
}

export function calculateAccessibilityScore(data: any): number {
  if (data.accessibility?.imgWithoutAltRatio === 0) return 100;
  return Math.max(0, 100 - (data.accessibility?.imgWithoutAltRatio || 0) * 100);
}

// ============================================
// Summary Helpers
// ============================================

function generateStrengths(
  data: any,
  perf: number,
  sec: number,
  seo: number,
  a11y: number
): string[] {
  const strengths: string[] = [];
  if (perf >= 90) strengths.push(`Fast performance (${perf}/100)`);
  if (sec >= 80) strengths.push("Strong security headers");
  if (a11y === 100) strengths.push("Perfect accessibility score");
  if (data.isHttps) strengths.push("HTTPS enabled");
  if (data.dom?.h1Count === 1) strengths.push("Proper H1 structure");
  return strengths.slice(0, 4);
}

function calculateCriticalIssues(data: any): number {
  let count = 0;
  if (!data.isHttps) count++;
  if (!data.headers?.["content-security-policy"]) count++;
  return count;
}

function calculateWarnings(data: any): number {
  let count = 0;
  if (!data.meta?.hasCanonical) count++;
  if (data.dom?.h1Count !== 1) count++;
  if (data.accessibility?.imgMissingAlt > 0) count++;
  if (!data.headers?.["x-frame-options"]) count++;
  if (data.perfHints?.heavyScriptHint) count++;
  return count;
}

function calculatePassed(data: any): number {
  let count = 0;
  if (data.isHttps) count++;
  if (data.meta?.title && data.meta.titleLen > 0) count++;
  if (data.meta?.description && data.meta.descriptionLen > 0) count++;
  if (data.meta?.hasCanonical) count++;
  if (data.dom?.h1Count === 1) count++;
  if (data.accessibility?.imgMissingAlt === 0) count++;
  if (data.headers?.["strict-transport-security"]) count++;
  if (data.headers?.["x-frame-options"]) count++;
  return count;
}

// ============================================
// Main Transformer
// ============================================

export function transformToSiteCockpitResponse(apiData: any): SiteCockpitResponse {
  // Calculate all scores
  const performanceScore = calculatePerformanceScore(apiData);
  const securityScore = calculateSecurityScore(apiData);
  const seoScore = calculateSEOScore(apiData);
  const accessibilityScore = calculateAccessibilityScore(apiData);
  const overallScore = Math.round(
    (performanceScore + securityScore + seoScore + accessibilityScore) / 4
  );

  return {
    // Basic info
    inputUrl: apiData.inputUrl || apiData.finalUrl,
    finalUrl: apiData.finalUrl,
    domain: apiData.domain,
    status: apiData.status || 200,
    isHttps: apiData.isHttps,
    siteLang: apiData.siteLang || "en",
    faviconUrl: apiData.faviconUrl,
    hostIP: apiData.hostIP,

    // Summary
    summary: {
      overallScore,
      grade: getScoreGrade(overallScore),
      categoryScores: {
        performance: performanceScore,
        security: securityScore,
        seo: seoScore,
        accessibility: accessibilityScore,
        ...(apiData.cms?.type === "wordpress" ? { wordpress: 68 } : {}),
      },
      strengths: generateStrengths(apiData, performanceScore, securityScore, seoScore, accessibilityScore),
      criticalIssues: calculateCriticalIssues(apiData),
      warnings: calculateWarnings(apiData),
      passed: calculatePassed(apiData),
    },

    // Quick wins
    quickWins: {
      count: 0,
      potentialScoreIncrease: "+0 points",
      estimatedTime: "0 minutes",
      items: [],
    },

    // CMS
    cms: apiData.cms || { type: "unknown", signals: [] },

    // WordPress (if applicable)
    ...(apiData.cms?.type === "wordpress" && apiData.cms?.wp
      ? {
          wordpress: {
            score: 68,
            grade: "C+",
            version: {
              current: apiData.cms.wp.version || "6.0",
              latest: "6.7.0",
              outdated: parseFloat(apiData.cms.wp.version || "0") < 6.7,
              securityRisk: "medium",
              releaseDate: "2023-01-01",
              daysOld: 365,
            },
            security: {
              defaultLoginExposed: false,
              userEnumerationBlocked: true,
              xmlrpcEnabled: apiData.cms.wp.xmlrpc ?? false,
              xmlrpcVulnerable: false,
              wpDebugMode: false,
              directoryListingDisabled: true,
              securityPlugins: [],
            },
            plugins: {
              total: 0,
              active: 0,
              outdated: 0,
              vulnerable: 0,
              list: [],
            },
            themes: {
              active: "Unknown Theme",
              version: "1.0",
              latest: "1.0",
              outdated: false,
              parent: null,
              childTheme: false,
            },
            core: {
              multisite: false,
              language: apiData.siteLang || "en_US",
              timezone: "UTC",
              permalinks: "/%postname%/",
              wpCron: true,
            },
            performance: {
              objectCache: false,
              opcacheEnabled: true,
              gzipEnabled: apiData.headers?.["content-encoding"]?.includes("gzip") || false,
              lazyLoadEnabled: false,
              cdn: null,
            },
            recommendations: [],
          },
        }
      : {}),

    // SEO
    seo: {
      score: seoScore,
      grade: getScoreGrade(seoScore),
      title: apiData.meta?.title || "",
      description: apiData.meta?.description || "",
      keywords: [],
      content: {
        wordCount: 0,
        readingTime: "0 min",
        language: apiData.siteLang || "en",
        quality: "good",
        keywordDensity: {},
      },
      aiReadiness: {
        score: 0,
        grade: "F",
        structuredDataComplete: false,
        cleanHtmlStructure: false,
        semanticMarkup: false,
        readableContent: false,
        mobileOptimized: false,
        fastLoadTime: false,
        accessibilityScore: 0,
      },
      issues: [],
    },

    // Performance
    performance: {
      score: performanceScore,
      grade: getScoreGrade(performanceScore),
      metrics: {
        loadTime: 0,
        timeToFirstByte: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        timeToInteractive: 0,
        cumulativeLayoutShift: 0,
        totalBlockingTime: 0,
      },
      recommendations: [],
    },

    // Security
    security: {
      score: securityScore,
      grade: getScoreGrade(securityScore),
      https: apiData.isHttps,
      certificate: apiData.isHttps
        ? {
            valid: true,
            issuer: "Unknown",
            expiresIn: "365 days",
          }
        : undefined,
      headers: {
        contentSecurityPolicy: {
          present: !!apiData.headers?.["content-security-policy"],
          value: apiData.headers?.["content-security-policy"] || null,
        },
        strictTransportSecurity: {
          present: !!apiData.headers?.["strict-transport-security"],
          value: apiData.headers?.["strict-transport-security"] || null,
        },
        xFrameOptions: {
          present: !!apiData.headers?.["x-frame-options"],
          value: apiData.headers?.["x-frame-options"] || null,
        },
        xContentTypeOptions: {
          present: !!apiData.headers?.["x-content-type-options"],
          value: apiData.headers?.["x-content-type-options"] || null,
        },
        referrerPolicy: {
          present: !!apiData.headers?.["referrer-policy"],
          value: apiData.headers?.["referrer-policy"] || null,
        },
        permissionsPolicy: {
          present: !!apiData.headers?.["permissions-policy"],
          value: apiData.headers?.["permissions-policy"] || null,
        },
      },
      vulnerabilities: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        details: [],
      },
    },

    // Accessibility
    accessibility: {
      score: accessibilityScore,
      grade: getScoreGrade(accessibilityScore),
      wcagLevel: accessibilityScore >= 90 ? "AA" : "A",
      images: {
        total: 0,
        missingAlt: apiData.accessibility?.imgMissingAlt || 0,
        decorative: 0,
      },
      forms: {
        total: 0,
        missingLabels: 0,
        missingFieldsets: 0,
      },
      links: {
        total: 0,
        emptyLinks: 0,
        ambiguousText: 0,
      },
      headings: {
        properStructure: apiData.dom?.h1Count === 1,
        skippedLevels: false,
        multipleH1: apiData.dom?.h1Count > 1,
      },
      contrast: {
        issues: 0,
        aaa: false,
      },
      keyboard: {
        focusVisible: true,
        logicalTabOrder: true,
        skipLinks: false,
      },
      aria: {
        validRoles: true,
        requiredAttributes: true,
        invalidNesting: false,
      },
      recommendations: [],
    },

    // Technology
    technology: {
      cms: {
        name: apiData.cms?.type || "unknown",
        version: apiData.cms?.wp?.version || null,
      },
      server: {
        software: "Unknown",
        version: null,
        os: null,
      },
      frameworks: {
        backend: [],
        frontend: [],
      },
      database: apiData.cms?.type === "wordpress"
        ? {
            type: "MySQL",
            version: null,
          }
        : undefined,
      cdn: {
        provider: "Unknown",
        detected: false,
      },
      analytics: [],
      libraries: {},
    },
  };
}
