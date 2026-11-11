// lib/reports/text.ts
//
// Translations for a report in the language the user picked, which can differ
// from the dashboard language (an agency in Berlin reporting to a client in
// Lyon). Loads messages/Reports and messages/Findings for that locale.

import { createTranslator } from 'next-intl';

import type { ReportLocale } from './options';
export { REPORT_LOCALES, isReportLocale, type ReportLocale } from './options';

type Values = Record<string, string | number | Date>;

export interface ReportText {
  locale: ReportLocale;
  /** A key under Reports.document. */
  t(key: string, values?: Values): string;
  has(key: string): boolean;
  /** Translated finding title, or the English fallback. */
  findingTitle(id: string | null, fallback: string): string;
  /** Translated recommendation for a finding, when one exists. */
  findingRecommendation(id: string): string | null;
  date(value: Date): string;
}

export function reportText(
  locale: ReportLocale,
  reports: Record<string, unknown>,
  findings: Record<string, unknown>,
): ReportText {
  const doc = createTranslator({ locale, messages: { Reports: reports } as never, namespace: 'Reports.document' as never });
  const fx = createTranslator({ locale, messages: { Findings: findings } as never, namespace: 'Findings' as never });
  const tDoc = doc as unknown as { (key: string, values?: Values): string; has(key: string): boolean };
  const tFx = fx as unknown as { (key: string): string; has(key: string): boolean };
  const dateFormat = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return {
    locale,
    t: (key, values) => tDoc(key, values),
    has: (key) => tDoc.has(key),
    findingTitle: (id, fallback) => (id && tFx.has(`${id}.title`) ? tFx(`${id}.title`) : fallback),
    findingRecommendation: (id) => (tFx.has(`${id}.recommendation`) ? tFx(`${id}.recommendation`) : null),
    date: (value) => dateFormat.format(value),
  };
}

/** Loads the two catalogs for a locale (server only). */
export async function loadReportText(locale: ReportLocale): Promise<ReportText> {
  const [reports, findings] = await Promise.all([
    import(`@/messages/Reports/${locale}.json`),
    import(`@/messages/Findings/${locale}.json`),
  ]);
  return reportText(locale, reports.default.Reports, findings.default.Findings);
}
