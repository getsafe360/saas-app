import type { SupportedLocale } from "./types";

export interface LocaleLabels {
  appBadge: string;
  title: string;
  subtitle: string;
  urlPlaceholder: string;
  analyzeButton: string;
  executiveSummary: string;
  recommendedAction: string;
  noCmsDetected: string;
  exportPdf: string;
  fullReport: string;
  terminal: {
    processing: string;
    standby: string;
    analyzingPackets: string;
    emptyState: string;
  };
  cardLabels: {
    metric: string;
    evidence: string;
    action: string;
  };
  fallbackText: string;
  errors: {
    invalidUrl: string;
    fetchFailed: string;
    streamFailed: string;
  };
}

const en: LocaleLabels = {
  appBadge: "Sparky AI Engine",
  title: "QUICK SNAPSHOT",
  subtitle:
    "Next-generation website analysis for developers. Instant audits, actionable insights, and WordPress automation.",
  urlPlaceholder: "Enter website URL (e.g. example.com)",
  analyzeButton: "Analyze",
  executiveSummary: "Executive Summary",
  recommendedAction: "Recommended Action",
  noCmsDetected: "No CMS Detected",
  exportPdf: "Export PDF",
  fullReport: "Full Report",
  terminal: {
    processing: "processing",
    standby: "standby",
    analyzingPackets: "Analyzing data packets...",
    emptyState: "Awaiting diagnostic input",
  },
  cardLabels: {
    metric: "Metric",
    evidence: "Evidence",
    action: "Action",
  },
  fallbackText: "No insight available.",
  errors: {
    invalidUrl: "Please enter a valid URL.",
    fetchFailed: "Could not fetch website source.",
    streamFailed: "Analysis stream disconnected before completion.",
  },
};

const localeMap: Record<SupportedLocale, LocaleLabels> = {
  en,
  de: en,
  es: en,
  fr: en,
  pt: en,
  it: en,
};

export function getLabels(locale: SupportedLocale): LocaleLabels {
  return localeMap[locale] ?? en;
}
