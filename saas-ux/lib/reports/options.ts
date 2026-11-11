// lib/reports/options.ts
//
// Report choices shared by the browser form and the server. No other imports,
// so the form does not pull rendering code into the page.

export type ReportFormat = 'pdf' | 'markdown';

export const REPORT_PERIODS = [30, 90, 365] as const;
export type ReportPeriodDays = (typeof REPORT_PERIODS)[number];

export const REPORT_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

export function isReportLocale(value: unknown): value is ReportLocale {
  return typeof value === 'string' && (REPORT_LOCALES as ReadonlyArray<string>).includes(value);
}
