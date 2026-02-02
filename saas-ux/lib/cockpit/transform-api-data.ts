// lib/cockpit/transform-api-data.ts
/**
 * Site Cockpit Data Transformer
 * 
 * Transforms analyze-facts API response → SiteCockpitResponse
 * 
 * Architecture Notes:
 * - Modular: Each category has its own transformer function
 * - Scalable: Easy to add new categories (i18n, chatbot, etc.)
 * - Type-safe: 100% aligned with types/site-cockpit.ts
 * - Future-proof: Prepared for comprehensive SEO expansion
 */

import type { SiteCockpitResponse, ScoreGrade } from "@/types/site-cockpit";

// ============================================
// SCORING SYSTEM
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

// ============================================
// CATEGORY SCORE CALCULATORS
// ============================================

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
// SUMMARY TRANSFORMERS
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
// CATEGORY TRANSFORMERS
// Future: Extract these to separate files for massive expansion
// ============================================

function transformWordPressData(apiData: any) {
  return {
    score: 68,
    grade: "C+" as ScoreGrade,
    version: {
      current: apiData.cms.wp.version || "6.0",
      latest: "6.7.0",
      outdated: parseFloat(apiData.cms.wp.version || "0") < 6.7,
      securityRisk: "medium" as const,
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
    performanceData: {
      objectCache: false,
      opcacheEnabled: true,
      gzipEnabled: apiData.headers?.["content-encoding"]?.includes("gzip") || false,
      lazyLoadEnabled: false,
      cdn: null,
    },
    recommendations: [],
  };
}

function transformSEOData(apiData: any, seoScore: number) {
  return {
    score: seoScore,
    grade: getScoreGrade(seoScore),
    meta: {
      title: apiData.meta?.title || "",
      titleLength: apiData.meta?.titleLen || 0,
      titleOptimal: (apiData.meta?.titleLen || 0) >= 30 && (apiData.meta?.titleLen || 0) <= 60,
      description: apiData.meta?.description || "",
      descriptionLength: apiData.meta?.descriptionLen || 0,
      descriptionOptimal: (apiData.meta?.descriptionLen || 0) >= 120 && (apiData.meta?.descriptionLen || 0) <= 160,
      robots: apiData.meta?.robotsMeta || "index,follow",
      canonical: apiData.finalUrl,
      hasCanonical: apiData.meta?.hasCanonical || false,
    },
    openGraph: {
      present: false,
      complete: false,
    },
    twitterCard: {
      present: false,
    },
    structuredData: {
      present: false,
      types: [],
      schemas: [],
      valid: false,
    },
    headings: {
      h1Count: apiData.dom?.h1Count || 0,
      h1Text: "",
      h1Optimal: apiData.dom?.h1Count === 1,
      properHierarchy: apiData.dom?.h1Count === 1,
      structure: {
        h1: apiData.dom?.h1Count || 0,
        h2: 0,
        h3: 0,
        h4: 0,
        h5: 0,
        h6: 0,
      },
    },
    content: {
      wordCount: 0,
      readingTime: "0 min",
      language: apiData.siteLang || "en",
      quality: "good",
      keywordDensity: {},
    },
    links: {
      internal: 0,
      external: 0,
      broken: 0,
      nofollow: 0,
      dofollow: 0,
    },
    images: {
      total: apiData.dom?.imgCount || 0,
      withAlt: (apiData.dom?.imgCount || 0) - (apiData.accessibility?.imgMissingAlt || 0),
      missingAlt: apiData.accessibility?.imgMissingAlt || 0,
      optimized: 0,
      needsOptimization: 0,
    },
    sitemap: {
      xmlPresent: false,
      xmlValid: false,
    },
    robotsTxt: {
      present: false,
      valid: false,
      blockedPaths: [],
      allowedBots: [],
      sitemapListed: false,
    },
    aiReadiness: {
      score: 0,
      grade: "F" as ScoreGrade,
      structuredDataComplete: false,
      cleanHtmlStructure: false,
      semanticMarkup: false,
      contentAccessible: false,
      llmFriendly: false,
      features: {
        schemaOrg: false,
        openGraph: false,
        jsonLd: false,
        semanticHtml5: false,
        accessibleContent: false,
        machineReadable: false,
      },
      recommendations: [],
    },
    reputation: {
      domainAge: "Unknown",
      domainAuthority: 0,
      trustScore: 0,
      backlinks: "0",
      referringDomains: "0",
      organicTraffic: "Unknown",
      brandMentions: "Unknown",
    },
  };
}

function transformPerformanceData(apiData: any, performanceScore: number) {
  // Estimate load time based on page weight (rough approximation)
  // Assumes ~1MB/s effective bandwidth, adjusted for compression
  const pageBytes = apiData.perfHints?.approxHtmlBytes || 0;
  const hasCompression = apiData.headers?.["content-encoding"]?.includes("gzip");
  const effectiveBytes = hasCompression ? pageBytes * 0.3 : pageBytes; // gzip typically 70% compression
  const estimatedLoadTime = Math.max(0.5, effectiveBytes / (1024 * 1024) * 2 + 0.3); // 0.3s base TTFB

  return {
    score: performanceScore,
    grade: getScoreGrade(performanceScore),
    metrics: {
      loadTime: Math.round(estimatedLoadTime * 10) / 10, // Round to 1 decimal
      timeToFirstByte: 0.3,
      firstContentfulPaint: Math.round(estimatedLoadTime * 0.4 * 10) / 10,
      largestContentfulPaint: Math.round(estimatedLoadTime * 0.8 * 10) / 10,
      timeToInteractive: Math.round(estimatedLoadTime * 1.2 * 10) / 10,
      cumulativeLayoutShift: 0.05,
      firstInputDelay: 50,
    },
    pageWeight: {
      total: "0 KB",
      totalBytes: apiData.perfHints?.approxHtmlBytes || 0,
      html: "0 KB",
      css: "0 KB",
      js: "0 KB",
      images: "0 KB",
      fonts: "0 KB",
      other: "0 KB",
    },
    requests: {
      total: (apiData.dom?.scriptCount || 0) + (apiData.dom?.linkCount || 0) + (apiData.dom?.imgCount || 0),
      html: 1,
      css: apiData.dom?.linkCount || 0,
      js: apiData.dom?.scriptCount || 0,
      images: apiData.dom?.imgCount || 0,
      fonts: 0,
      other: 0,
    },
    caching: {
      browserCacheEnabled: false,
      cacheHeaders: [],
      cacheDuration: "Unknown",
    },
    compression: {
      enabled: apiData.headers?.["content-encoding"]?.includes("gzip") || false,
      type: apiData.headers?.["content-encoding"] || "none",
      compressionRatio: 0,
    },
    cdn: {
      detected: false,
      regions: [],
    },
    webVitals: {
      lcp: {
        value: 0,
        rating: "good" as const,
        threshold: 2500,
      },
      fid: {
        value: 0,
        rating: "good" as const,
        threshold: 100,
      },
      cls: {
        value: 0,
        rating: "good" as const,
        threshold: 0.1,
      },
    },
  };
}

function transformSecurityData(apiData: any, securityScore: number) {
  return {
    score: securityScore,
    grade: getScoreGrade(securityScore),
    https: {
      enabled: apiData.isHttps,
      forced: apiData.isHttps,
      hsts: !!apiData.headers?.["strict-transport-security"],
      hstsIncludeSubdomains: false,
      hstsPreload: false,
    },
    ssl: {
      valid: apiData.isHttps,
      issuer: "Unknown",
      validFrom: "Unknown",
      validUntil: "Unknown",
      daysRemaining: 365,
      protocol: "TLS 1.3",
      cipher: "Unknown",
      grade: apiData.isHttps ? "A" : "F",
    },
    headers: {
      contentSecurityPolicy: {
        present: !!apiData.headers?.["content-security-policy"],
        value: apiData.headers?.["content-security-policy"] || undefined,
      },
      strictTransportSecurity: {
        present: !!apiData.headers?.["strict-transport-security"],
        value: apiData.headers?.["strict-transport-security"] || undefined,
      },
      xFrameOptions: {
        present: !!apiData.headers?.["x-frame-options"],
        value: apiData.headers?.["x-frame-options"] || undefined,
      },
      xContentTypeOptions: {
        present: !!apiData.headers?.["x-content-type-options"],
        value: apiData.headers?.["x-content-type-options"] || undefined,
      },
      referrerPolicy: {
        present: !!apiData.headers?.["referrer-policy"],
        value: apiData.headers?.["referrer-policy"] || undefined,
      },
      permissionsPolicy: {
        present: !!apiData.headers?.["permissions-policy"],
        value: apiData.headers?.["permissions-policy"] || undefined,
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
    recommendations: [],
  };
}

function transformAccessibilityData(apiData: any, accessibilityScore: number) {
  const wcagLevel: "A" | "AA" | "AAA" = accessibilityScore >= 90 ? "AA" : "A";

  return {
    score: accessibilityScore,
    grade: getScoreGrade(accessibilityScore),
    wcagLevel,
    images: {
      total: apiData.dom?.imgCount || 0,
      withAlt: (apiData.dom?.imgCount || 0) - (apiData.accessibility?.imgMissingAlt || 0),
      missingAlt: apiData.accessibility?.imgMissingAlt || 0,
      emptyAlt: 0,
      decorativeImages: 0,
    },
    forms: {
      total: 0,
      withLabels: 0,
      missingLabels: 0,
      accessibleNames: true,
    },
    links: {
      total: apiData.dom?.linkCount || 0,
      withText: apiData.dom?.linkCount || 0,
      emptyLinks: 0,
      descriptiveText: true,
    },
    headings: {
      properHierarchy: apiData.dom?.h1Count === 1,
      skippedLevels: false,
      structure: apiData.dom?.h1Count > 1 ? "Multiple H1s detected" : "Proper structure",
    },
    aria: {
      landmarks: true,
      labels: true,
      roles: true,
      live: false,
    },
    keyboard: {
      focusVisible: true,
      tabOrder: true,
      skipLinks: false,
    },
    contrast: {
      issues: 0,
      lowContrast: [],
    },
    language: {
      htmlLang: !!apiData.siteLang,
      langAttribute: apiData.siteLang || "en",
    },
  };
}

function transformTechnologyData(apiData: any) {
  return {
    server: {
      software: apiData.headers?.["server"] || "Unknown",
      version: null,
      os: null,
    },
    programming: {
      languages: [],
    },
    frameworks: {
      backend: [],
      frontend: [],
    },
    libraries: {},
    cms: {
      name: apiData.cms?.type || "unknown",
      version: apiData.cms?.wp?.version || "Unknown",
    },
    analytics: [],
    tagManagers: [],
    cdn: {
      provider: "Unknown",
      detected: false,
    },
    hosting: {
      provider: "Unknown",
      datacenter: "Unknown",
    },
    protocols: {
      http2: false,
      http3: false,
      quic: false,
    },
    compression: {
      brotli: false,
      gzip: apiData.headers?.["content-encoding"]?.includes("gzip") || false,
    },
    caching: {
      edgeCache: false,
      browserCache: false,
      objectCache: false,
    },
  };
}

function transformMobileData() {
  return {
    score: 0,
    grade: "F" as ScoreGrade,
    responsive: false,
    viewport: {
      present: false,
      value: "",
    },
    touchOptimized: {
      tapTargets: false,
      tapTargetSize: 0,
      spacing: 0,
    },
    textReadability: {
      fontSizeOptimal: false,
      minFontSize: 0,
      lineHeight: 0,
    },
    mobilePerformance: {
      loadTime: 0,
      mobileOptimized: false,
    },
  };
}

function transformNetworkData(apiData: any) {
  return {
    ipVersion: "IPv4" as const,
    ipv4: apiData.hostIP || null,
    ipv6: null,
    dualStack: false,
    dnsRecords: {
      a: apiData.hostIP ? [apiData.hostIP] : [],
      aaaa: [],
      mx: [],
      txt: [],
    },
    geolocation: {
      country: "Unknown",
      countryName: "Unknown",
      region: "Unknown",
      city: "Unknown",
      latitude: 0,
      longitude: 0,
      isp: "Unknown",
      organization: "Unknown",
    },
    latency: {
      dnsLookup: 0,
      tcpConnection: 0,
      tlsHandshake: 0,
      serverProcessing: 0,
      contentDownload: 0,
    },
  };
}

// ============================================
// MAIN TRANSFORMER
// ============================================

export function transformToSiteCockpitResponse(apiData: any): SiteCockpitResponse {
  // Calculate all category scores
  const performanceScore = calculatePerformanceScore(apiData);
  const securityScore = calculateSecurityScore(apiData);
  const seoScore = calculateSEOScore(apiData);
  const accessibilityScore = calculateAccessibilityScore(apiData);
  const overallScore = Math.round(
    (performanceScore + securityScore + seoScore + accessibilityScore) / 4
  );

  return {
    // === BASIC INFO ===
    inputUrl: apiData.inputUrl || apiData.finalUrl,
    finalUrl: apiData.finalUrl,
    domain: apiData.domain,
    status: apiData.status || 200,
    isHttps: apiData.isHttps,
    siteLang: apiData.siteLang || "en",
    faviconUrl: apiData.faviconUrl,
    hostIP: apiData.hostIP,

    // === SUMMARY (Hero Section) ===
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

    // === QUICK WINS (Actionable Improvements) ===
    quickWins: {
      count: 0,
      potentialScoreIncrease: "+0 points",
      estimatedTime: "0 minutes",
      items: [],
    },

    // === CMS DETECTION ===
    cms: apiData.cms || { type: "unknown", signals: [] },

    // === WORDPRESS SPOTLIGHT (Conditional) ===
    ...(apiData.cms?.type === "wordpress" && apiData.cms?.wp
      ? { wordpress: transformWordPressData(apiData) }
      : {}),

    // === CORE CATEGORIES ===
    seo: transformSEOData(apiData, seoScore),
    performance: transformPerformanceData(apiData, performanceScore),
    security: transformSecurityData(apiData, securityScore),
    accessibility: transformAccessibilityData(apiData, accessibilityScore),

    // === TECHNOLOGY & INFRASTRUCTURE ===
    technology: transformTechnologyData(apiData),
    mobile: transformMobileData(),
    network: transformNetworkData(apiData),

    // === LEGACY FIELDS (Keep for backwards compatibility) ===
    dom: {
      h1Count: apiData.dom?.h1Count || 0,
      imgCount: apiData.dom?.imgCount || 0,
      scriptCount: apiData.dom?.scriptCount || 0,
      linkCount: apiData.dom?.linkCount || 0,
    },
    meta: {
      title: apiData.meta?.title || "",
      description: apiData.meta?.description || "",
      titleLen: apiData.meta?.titleLen || 0,
      descriptionLen: apiData.meta?.descriptionLen || 0,
      robotsMeta: apiData.meta?.robotsMeta || "index,follow",
      hasCanonical: apiData.meta?.hasCanonical || false,
    },
    headers: apiData.headers || {},
  };
}