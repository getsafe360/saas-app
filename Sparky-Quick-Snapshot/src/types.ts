export type SupportedLocale = "en" | "de" | "es" | "fr" | "pt" | "it";

export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "METRIC" | "ERROR";

export interface StreamEvent {
  level: LogLevel;
  stage: string;
  message: string;
  metric?: string;
  evidence?: string;
  detailHint?: string;
}

export interface TerminalLogEntry {
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
  metric?: string;
}

export type InsightStatus = "good" | "warning" | "critical";

export interface InsightCardData {
  status: InsightStatus;
  summary: string;
  metric: string;
  evidence: string;
  actionHint: string;
}

export interface WordpressInsights {
  detected: boolean;
  version?: string;
  theme?: string;
  insightsSummary?: string;
  pluginRisks?: string[];
  automationHints?: string[];
}

export interface AnalysisCta {
  headline: string;
  body: string;
  buttonText: string;
  deepLink: string;
}

export interface AnalysisResult {
  accessibility: InsightCardData;
  performance: InsightCardData;
  seo: InsightCardData;
  security: InsightCardData;
  content: InsightCardData;
  wordpress?: WordpressInsights;
  streamEvents?: StreamEvent[];
  summary: string;
  cta: AnalysisCta;
}

export type Category = "accessibility" | "performance" | "seo" | "security" | "content";
