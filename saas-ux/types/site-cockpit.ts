// types/site-cockpit.ts
// Complete TypeScript definitions for Site Cockpit API

export type ScoreGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F";
export type ImpactLevel = "critical" | "high" | "medium" | "low";
export type EffortLevel = "low" | "medium" | "high";
export type CategoryType =
  | "performance"
  | "security"
  | "seo"
  | "accessibility"
  | "wordpress"
  | "tech"
  | "geo";

// ===== QUICK WINS =====
export interface QuickWinFix {
  description: string;
  oneClickAvailable: boolean;
  code?: string;
  command?: string;
  documentation: string;
}

export interface QuickWinItem {
  id: string;
  category: CategoryType;
  title: string;
  issue: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  currentScore: number;
  potentialScore: number;
  scoreIncrease: number;
  fix: QuickWinFix;
}

export interface QuickWins {
  count: number;
  potentialScoreIncrease: string;
  estimatedTime: string;
  items: QuickWinItem[];
}

// ===== WORDPRESS SPOTLIGHT =====
export interface WordPressVulnerability {
  id: string;
  severity: ImpactLevel;
  description: string;
  fixedIn: string;
}

export interface WordPressPlugin {
  name: string;
  slug: string;
  version: string;
  latest: string;
  outdated: boolean;
  vulnerable: boolean;
  lastUpdated: string;
  vulnerabilities?: WordPressVulnerability[];
}

export interface WordPressTheme {
  active: string;
  version: string;
  latest: string;
  outdated: boolean;
  parent: string | null;
  childTheme: boolean;
}

export interface WordPressSecurity {
  defaultLoginExposed: boolean;
  userEnumerationBlocked: boolean;
  xmlrpcEnabled: boolean;
  xmlrpcVulnerable: boolean;
  wpDebugMode: boolean;
  directoryListingDisabled: boolean;
  securityPlugins: string[];
}

export interface WordPressRecommendation {
  priority: ImpactLevel;
  title: string;
  description: string;
  action: string;
}

export type WordPressHealthCategory =
  | "security"
  | "performance"
  | "stability"
  | "seo-ux"
  | "red-flags";

export interface WordPressHealthFinding {
  id: string;
  category: WordPressHealthCategory;
  title: string;
  description: string;
  severity: ImpactLevel;
  checkedByDefault: boolean;
  status: "pass" | "warning" | "fail" | "unknown";
  action: string;
}

export interface WordPress {
  score: number;
  grade: ScoreGrade;
  version: {
    current: string;
    latest: string;
    outdated: boolean;
    securityRisk: ImpactLevel;
    releaseDate: string;
    daysOld: number;
  };
  security: WordPressSecurity;
  plugins: {
    total: number;
    active: number;
    outdated: number;
    vulnerable: number;
    list: WordPressPlugin[];
  };
  themes: WordPressTheme;
  core: {
    multisite: boolean;
    language: string;
    timezone: string;
    permalinks: string;
    wpCron: boolean;
  };
  performanceData: {
    objectCache: boolean;
    opcacheEnabled: boolean;
    gzipEnabled: boolean;
    lazyLoadEnabled: boolean;
    cdn: string | null;
  };
  healthFindings?: WordPressHealthFinding[];
  recommendations: WordPressRecommendation[];
}

// ===== SEO =====
export interface SEOStructuredDataSchema {
  type: string;
  name?: string;
  url?: string;
  logo?: string;
  potentialAction?: {
    type: string;
  };
}

export interface SEOStructuredData {
  present: boolean;
  types: string[];
  schemas: SEOStructuredDataSchema[];
  valid: boolean;
}

export interface SEOHeadingStructure {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
}

export interface SEOAIReadiness {
  score: number;
  grade: ScoreGrade;
  structuredDataComplete: boolean;
  cleanHtmlStructure: boolean;
  semanticMarkup: boolean;
  contentAccessible: boolean;
  llmFriendly: boolean;
  features: {
    schemaOrg: boolean;
    openGraph: boolean;
    jsonLd: boolean;
    semanticHtml5: boolean;
    accessibleContent: boolean;
    machineReadable: boolean;
  };
  recommendations: string[];
}

export interface SEOReputation {
  domainAge: string;
  domainAuthority: number;
  trustScore: number;
  backlinks: string;
  referringDomains: string;
  organicTraffic: string;
  brandMentions: string;
}

export interface SEOData {
  score: number;
  grade: ScoreGrade;
  meta: {
    title: string;
    titleLength: number;
    titleOptimal: boolean;
    description: string;
    descriptionLength: number;
    descriptionOptimal: boolean;
    robots: string;
    canonical: string;
    hasCanonical: boolean;
  };
  openGraph: {
    present: boolean;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    complete: boolean;
  };
  twitterCard: {
    present: boolean;
    cardType?: string;
    twitterSite?: string;
    twitterImage?: string;
  };
  structuredData: SEOStructuredData;
  headings: {
    h1Count: number;
    h1Text: string;
    h1Optimal: boolean;
    properHierarchy: boolean;
    structure: SEOHeadingStructure;
  };
  content: {
    wordCount: number;
    readingTime: string;
    language: string;
    quality: string;
    keywordDensity: Record<string, number>;
  };
  links: {
    internal: number;
    external: number;
    broken: number;
    nofollow: number;
    dofollow: number;
  };
  images: {
    total: number;
    withAlt: number;
    missingAlt: number;
    optimized: number;
    needsOptimization: number;
  };
  sitemap: {
    xmlPresent: boolean;
    xmlUrl?: string;
    xmlValid: boolean;
    pages?: number;
    lastModified?: string;
  };
  robotsTxt: {
    present: boolean;
    url?: string;
    valid: boolean;
    blockedPaths: string[];
    allowedBots: string[];
    sitemapListed: boolean;
  };
  aiReadiness: SEOAIReadiness;
  reputation: SEOReputation;
}

// ===== PERFORMANCE =====
export interface PerformanceMetrics {
  loadTime: number;
  timeToFirstByte: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

export interface PageWeight {
  total: string;
  totalBytes: number;
  html: string;
  css: string;
  js: string;
  images: string;
  fonts: string;
  other: string;
}

export interface Requests {
  total: number;
  html: number;
  css: number;
  js: number;
  images: number;
  fonts: number;
  other: number;
}

export interface WebVitalMetric {
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  threshold: number;
}

export interface Performance {
  score: number;
  grade: ScoreGrade;
  metrics: PerformanceMetrics;
  pageWeight: PageWeight;
  requests: Requests;
  caching: {
    browserCacheEnabled: boolean;
    cacheHeaders: string[];
    cacheDuration: string;
  };
  compression: {
    enabled: boolean;
    type: string;
    compressionRatio: number;
  };
  cdn: {
    detected: boolean;
    provider?: string;
    regions: string[];
  };
  webVitals: {
    lcp: WebVitalMetric;
    fid: WebVitalMetric;
    cls: WebVitalMetric;
  };
}

// ===== SECURITY =====
export interface SecurityVulnerability {
  severity: ImpactLevel;
  component: string;
  vulnerability: string;
  cve: string;
  fixAvailable: boolean;
  fixVersion?: string;
}

export interface SecurityHeader {
  present: boolean;
  value?: string;
  impact?: ImpactLevel;
}

export interface SecurityRecommendation {
  priority: ImpactLevel;
  title: string;
  description: string;
}

export interface SecurityData {
  score: number;
  grade: ScoreGrade;
  https: {
    enabled: boolean;
    forced: boolean;
    hsts: boolean;
    hstsMaxAge?: number;
    hstsIncludeSubdomains: boolean;
    hstsPreload: boolean;
  };
  ssl: {
    valid: boolean;
    issuer: string;
    validFrom: string;
    validUntil: string;
    daysRemaining: number;
    protocol: string;
    cipher: string;
    grade: string;
  };
  headers: {
    contentSecurityPolicy: SecurityHeader;
    strictTransportSecurity: SecurityHeader;
    xFrameOptions: SecurityHeader;
    xContentTypeOptions: SecurityHeader;
    referrerPolicy: SecurityHeader;
    permissionsPolicy: SecurityHeader;
  };
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    details: SecurityVulnerability[];
  };
  recommendations: SecurityRecommendation[];
}

// ===== TECHNOLOGY =====
export interface Technology {
  server: {
    software: string;
    version: string | null;
    os: string | null;
  };
  programming: {
    languages: string[];
    phpVersion?: string;
    phpOutdated?: boolean;
    phpEol?: string;
  };
  frameworks: {
    backend: string[];
    frontend: string[];
  };
  libraries: {
    jquery?: string;
    react?: string;
    vue?: string;
  };
  cms: {
    name: string;
    version: string;
  };
  analytics: string[];
  tagManagers: string[];
  cdn: {
    provider: string;
    detected: boolean;
  };
  hosting: {
    provider: string;
    datacenter: string;
  };
  protocols: {
    http2: boolean;
    http3: boolean;
    quic: boolean;
  };
  compression: {
    brotli: boolean;
    gzip: boolean;
  };
  caching: {
    edgeCache: boolean;
    browserCache: boolean;
    objectCache: boolean;
  };
}

// ===== ACCESSIBILITY =====
export interface Accessibility {
  score: number;
  grade: ScoreGrade;
  wcagLevel: "A" | "AA" | "AAA";
  images: {
    total: number;
    withAlt: number;
    missingAlt: number;
    emptyAlt: number;
    decorativeImages: number;
  };
  forms: {
    total: number;
    withLabels: number;
    missingLabels: number;
    accessibleNames: boolean;
  };
  links: {
    total: number;
    withText: number;
    emptyLinks: number;
    descriptiveText: boolean;
  };
  headings: {
    properHierarchy: boolean;
    skippedLevels: boolean;
    structure: string;
  };
  aria: {
    landmarks: boolean;
    labels: boolean;
    roles: boolean;
    live: boolean;
  };
  keyboard: {
    focusVisible: boolean;
    tabOrder: boolean;
    skipLinks: boolean;
  };
  contrast: {
    issues: number;
    lowContrast: any[];
  };
  language: {
    htmlLang: boolean;
    langAttribute: string;
  };
}

// ===== MOBILE =====
export interface Mobile {
  score: number;
  grade: ScoreGrade;
  responsive: boolean;
  viewport: {
    present: boolean;
    value: string;
  };
  touchOptimized: {
    tapTargets: boolean;
    tapTargetSize: number;
    spacing: number;
  };
  textReadability: {
    fontSizeOptimal: boolean;
    minFontSize: number;
    lineHeight: number;
  };
  mobilePerformance: {
    loadTime: number;
    mobileOptimized: boolean;
  };
}

// ===== NETWORK =====
export interface Network {
  ipVersion: "IPv4" | "IPv6" | "Dual-Stack";
  ipv4: string | null;
  ipv6: string | null;
  dualStack: boolean;
  dnsRecords: {
    a: string[];
    aaaa: string[];
    mx: string[];
    txt: string[];
  };
  geolocation: {
    country: string;
    countryName: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
    isp: string;
    organization: string;
  };
  latency: {
    dnsLookup: number;
    tcpConnection: number;
    tlsHandshake: number;
    serverProcessing: number;
    contentDownload: number;
  };
}

// ===== SUMMARY =====
export interface Summary {
  overallScore: number;
  grade: ScoreGrade;
  categoryScores: {
    performance: number;
    security: number;
    seo: number;
    accessibility: number;
    wordpress?: number;
  };
  strengths: string[];
  categoryInsights?: {
    performance: {
      criticalIssues: number;
      warnings: number;
      passed: number;
      topIssues: string[];
    };
    security: {
      criticalIssues: number;
      warnings: number;
      passed: number;
      topIssues: string[];
    };
    seo: {
      criticalIssues: number;
      warnings: number;
      passed: number;
      topIssues: string[];
    };
    accessibility: {
      criticalIssues: number;
      warnings: number;
      passed: number;
      topIssues: string[];
    };
  };
  criticalIssues: number;
  warnings: number;
  passed: number;
}

// ===== MAIN RESPONSE =====
export interface SiteCockpitResponse {
  // Basic info
  inputUrl: string;
  finalUrl: string;
  domain: string;
  status: number;
  isHttps: boolean;
  siteLang: string;
  faviconUrl: string;
  hostIP: string;

  // Summary (hero)
  summary: Summary;

  // Quick wins (prominent)
  quickWins: QuickWins;

  // CMS detection
  cms: {
    type: string;
    name?: string;
    version?: string;
    signals: string[];
    wp?: {
      version: string;
      jsonApi: boolean;
      xmlrpc: boolean | null;
    };
  };

  // Add connection metadata
  connectionStatus?: {
    isConnected: boolean;
    connectedAt?: string;
    lastSync?: string;
    pluginVersion?: string;
  };

  // WordPress spotlight (when WP detected)
  wordpress?: WordPress;

  // Core categories
  seo: SEOData;
  performance: Performance;
  security: SecurityData;
  accessibility: Accessibility;

  // Technology & infrastructure
  technology: Technology;
  mobile: Mobile;
  network: Network;

  // Legacy/existing fields
  dom: {
    h1Count: number;
    imgCount: number;
    scriptCount: number;
    linkCount: number;
  };
  meta: {
    title: string;
    description: string;
    titleLen: number;
    descriptionLen: number;
    robotsMeta: string;
    hasCanonical: boolean;
  };
  headers: Record<string, string>;
}

// ===== HELPER TYPES =====
export interface CategoryTheme {
  color: string;
  bgGradient: string;
  border: string;
  glow: string;
}

export const CATEGORY_THEMES: Record<CategoryType, CategoryTheme> = {
  performance: {
    color: "#10B981",
    bgGradient: "from-green-500/10 to-green-600/5",
    border: "border-green-500/20",
    glow: "shadow-green-500/50",
  },
  security: {
    color: "#EF4444",
    bgGradient: "from-red-500/10 to-red-600/5",
    border: "border-red-500/20",
    glow: "shadow-red-500/50",
  },
  seo: {
    color: "#3B82F6",
    bgGradient: "from-blue-500/10 to-blue-600/5",
    border: "border-blue-500/20",
    glow: "shadow-blue-500/50",
  },
  accessibility: {
    color: "#8B5CF6",
    bgGradient: "from-purple-500/10 to-purple-600/5",
    border: "border-purple-500/20",
    glow: "shadow-purple-500/50",
  },
  wordpress: {
    color: "#21759B",
    bgGradient: "from-blue-600/10 to-blue-700/5",
    border: "border-blue-600/20",
    glow: "shadow-blue-600/50",
  },
  geo: {
    color: "#9333EA",
    bgGradient: "from-fuchsia-500/12 via-blue-500/10 to-violet-500/12",
    border: "border-fuchsia-500/25",
    glow: "shadow-fuchsia-500/50",
  },
  tech: {
    color: "#F97316",
    bgGradient: "from-orange-500/10 to-orange-600/5",
    border: "border-orange-500/20",
    glow: "shadow-orange-500/50",
  },
};

// ===== UTILITY FUNCTIONS =====
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

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

export function getImpactColor(impact: ImpactLevel): string {
  const colors = {
    critical: "text-red-600",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-blue-500",
  };
  return colors[impact];
}
