// components/analyzer/types.ts

// Core analysis types
export type AnalysisStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export type Pillar = 'seo' | 'a11y' | 'perf' | 'sec';

export type Severity = 'minor' | 'medium' | 'critical';

export type Finding = {
  pillar: Pillar;
  severity: Severity;
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  code?: string;
  line?: number;
};

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

export type CMSType = 
  | 'wordpress' 
  | 'drupal' 
  | 'joomla' 
  | 'shopify' 
  | 'wix' 
  | 'squarespace'
  | 'magento'
  | 'prestashop'
  | 'custom'
  | 'unknown';

export type WordPressInfo = {
  version?: string;
  jsonApi?: boolean | null;
  xmlrpc?: boolean | null;
  pluginsDetected?: string[];
  themeDetected?: string;
};

export type CMSInfo = {
  type: CMSType;
  wp?: WordPressInfo;
  version?: string;
  confidence?: number; // 0-100
};

// Site facts/metadata types
export type Facts = {
  domain: string;
  finalUrl: string;
  status: number;
  isHttps: boolean;
  faviconUrl?: string | null;
  siteLang?: string | null;
  title?: string;
  description?: string;
  cms: CMSInfo;
  headers?: Record<string, string>;
  loadTime?: number;
  pageSize?: number;
  technologies?: string[];
  hostIP?: string;
};

// Analysis payload
export type AnalysisPayload = {
  url: string;
  markdown: string;
  findings: Finding[];
  facts?: Facts | null;
  locale: string;
  timestamp: string;
  scores?: Scores;
};

export type facts = Awaited<ReturnType<typeof import("@/lib/analyzer/preScan")["preScan"]>>;

// Screenshot types
export type ScreenshotUrls = {
  desktopHi: string;
  desktopLo: string;
  mobileHi: string;
  mobileLo: string;
};

// Component prop types
export type ReportHeroProps = {
  url: string;
  screenshotUrl: string;
  lowResUrl: string;
  mobileUrl: string;
  mobileLowResUrl: string;
  lastChecked: string;
  lang?: string;
  status?: string;
  cmsLabel?: string;
  pillars: {
    seo: { pass: number; warn: number; crit: number };
    a11y: { pass: number; warn: number; crit: number };
    perf: { pass: number; warn: number; crit: number };
    sec: { pass: number; warn: number; crit: number };
  };
  onFixAll?: () => void;
};

export type SiteIdentityCardProps = {
  domain: string;
  finalUrl: string;
  status: number;
  isHttps: boolean;
  faviconUrl: string | null;
  siteLang: string | null;
  uiLocale: string;
  cms: CMSInfo;
};

export type PillarColumnProps = {
  label: string;
  score: PillarScore;
  items: Finding[];
};