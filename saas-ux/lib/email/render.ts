// lib/email/render.ts
//
// Renders the five transactional emails to { subject, html, text } in the
// recipient's language. Pure functions (no I/O), so they are easy to test.
//
// Every dynamic value is HTML-escaped: site URLs, finding titles and names come
// from users or from third-party sites and must never be able to inject markup.

import { locales, defaultLocale, type Locale } from '@/config/i18n';
import { EMAIL_MESSAGES, type EmailMessages } from './messages';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ─── Locale ─────────────────────────────────────────────────────────────────

/** 'de', 'de-CH', 'DE_de' → 'de'. Empty or unsupported → English. */
export function resolveEmailLocale(language?: string | null): Locale {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (locales as readonly string[]).includes(base) ? (base as Locale) : defaultLocale;
}

const INTL_TAG: Record<Locale, string> = {
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  pt: 'pt-BR', // 'pt' is Brazilian Portuguese in this app
};

export function formatEmailDate(date: Date | number, locale: Locale): string {
  const d = new Date(typeof date === 'number' ? date * 1000 : date);
  return new Intl.DateTimeFormat(INTL_TAG[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function formatEmailAmount(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAG[locale], {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatEmailNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAG[locale]).format(n);
}

// ─── HTML helpers ───────────────────────────────────────────────────────────

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

const C = {
  page: '#0b1215',
  card: '#121b20',
  border: '#22313a',
  text: '#e6edf3',
  muted: '#8b98a5',
  accent: '#38bdf8',
  accentText: '#04121a',
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#fb923c';
  return '#f87171';
}

function severityColor(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') return '#f87171';
  if (s === 'medium' || s === 'warning') return '#fb923c';
  return '#38bdf8';
}

function row(label: string, value: string): string {
  return `<tr>
<td style="padding:8px 0;color:${C.muted};font-size:14px;border-bottom:1px solid ${C.border};">${esc(label)}</td>
<td style="padding:8px 0;color:${C.text};font-size:14px;text-align:right;border-bottom:1px solid ${C.border};">${esc(value)}</td>
</tr>`;
}

function rowsTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows
    .map(([l, v]) => row(l, v))
    .join('')}</table>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background:${C.accent};border-radius:8px;">
<a href="${esc(safeUrl(url))}" style="display:inline-block;padding:12px 24px;color:${C.accentText};font-size:15px;font-weight:600;text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

interface LayoutArgs {
  locale: Locale;
  m: EmailMessages;
  title: string;
  greeting: string;
  intro: string;
  bodyHtml?: string;
  cta?: { label: string; url: string };
}

function layout(a: LayoutArgs): string {
  return `<!doctype html>
<html lang="${a.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(a.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.border};border-radius:12px;">
<tr><td style="padding:28px 32px 0;color:${C.accent};font-size:13px;font-weight:700;letter-spacing:.08em;">GETSAFE 360 AI</td></tr>
<tr><td style="padding:12px 32px 0;color:${C.text};font-size:24px;font-weight:700;line-height:1.3;">${esc(a.title)}</td></tr>
<tr><td style="padding:16px 32px 28px;color:${C.text};font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px;">${esc(a.greeting)}</p>
<p style="margin:0;color:${C.muted};">${esc(a.intro)}</p>
${a.bodyHtml ?? ''}
${a.cta ? button(a.cta.label, a.cta.url) : ''}
</td></tr>
</table>
<p style="max-width:560px;margin:16px 0 0;color:${C.muted};font-size:12px;line-height:1.5;text-align:center;">${esc(a.m.common.footer)}<br>${esc(a.m.common.copyright(new Date().getFullYear()))}</p>
</td></tr></table>
</body></html>`;
}

function plainText(parts: Array<string | undefined | false>): string {
  return parts.filter((p): p is string => !!p).join('\n\n');
}

function rowsText(rows: Array<[string, string]>): string {
  return rows.map(([l, v]) => `${l}: ${v}`).join('\n');
}

// ─── 1. Welcome ─────────────────────────────────────────────────────────────

export function renderWelcome(
  locale: Locale,
  d: { firstName: string; dashboardUrl: string },
): RenderedEmail {
  const m = EMAIL_MESSAGES[locale];
  const t = m.welcome;
  return {
    subject: t.subject,
    html: layout({
      locale, m,
      title: t.heading,
      greeting: m.common.hi(d.firstName),
      intro: t.body,
      cta: { label: t.cta, url: d.dashboardUrl },
    }),
    text: plainText([m.common.hi(d.firstName), t.body, `${t.cta}: ${d.dashboardUrl}`]),
  };
}

// ─── 2. Subscription confirmation ───────────────────────────────────────────

export function renderSubscription(
  locale: Locale,
  d: {
    firstName: string;
    planName: string;
    billingAmount: string;
    billingPeriod: string; // 'month' | 'year'
    tokenBalance: string;
    nextRenewalDate: string;
    dashboardUrl: string;
  },
): RenderedEmail {
  const m = EMAIL_MESSAGES[locale];
  const t = m.subscription;
  const period = d.billingPeriod === 'year' ? m.perPeriod.year : m.perPeriod.month;
  const rows: Array<[string, string]> = [[t.plan, d.planName]];
  if (d.billingAmount) rows.push([t.amount, `${d.billingAmount}${period}`]);
  if (d.tokenBalance) rows.push([t.tokens, d.tokenBalance]);
  if (d.nextRenewalDate) rows.push([t.renewal, d.nextRenewalDate]);

  return {
    subject: t.subject(d.planName),
    html: layout({
      locale, m,
      title: t.heading,
      greeting: m.common.hi(d.firstName),
      intro: t.body(d.planName),
      bodyHtml: rowsTable(rows),
      cta: { label: t.cta, url: d.dashboardUrl },
    }),
    text: plainText([
      m.common.hi(d.firstName),
      t.body(d.planName),
      rowsText(rows),
      `${t.cta}: ${d.dashboardUrl}`,
    ]),
  };
}

// ─── 3. Scan complete ───────────────────────────────────────────────────────

export interface RenderFinding {
  severity: string;
  title: string;
  description: string;
}

export function renderScan(
  locale: Locale,
  d: {
    firstName: string;
    siteUrl: string;
    overallScore: number;
    seoScore: number;
    perfScore: number;
    secScore: number;
    a11yScore: number;
    topFindings: RenderFinding[];
    remainingCount: number;
    resultsUrl: string;
  },
): RenderedEmail {
  const m = EMAIL_MESSAGES[locale];
  const t = m.scan;

  const categories: Array<[string, number]> = [
    [t.seo, d.seoScore],
    [t.performance, d.perfScore],
    [t.security, d.secScore],
    [t.accessibility, d.a11yScore],
  ];
  // Category scores are only shown when they were actually measured.
  const showCategories = categories.some(([, s]) => s > 0);

  const scoreBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>
<td style="color:${C.muted};font-size:14px;">${esc(t.overall)}</td>
<td style="text-align:right;color:${scoreColor(d.overallScore)};font-size:32px;font-weight:700;">${esc(d.overallScore)}</td>
</tr></table>`;

  const categoryBlock = showCategories
    ? rowsTable(categories.map(([l, s]) => [l, String(s)] as [string, string]))
    : '';

  const findings = d.topFindings.filter((f) => f.title);
  const findingsBlock = findings.length
    ? `<p style="margin:24px 0 8px;color:${C.text};font-size:15px;font-weight:600;">${esc(t.topFindings)}</p>${findings
        .map((f) => {
          const label = m.severity[f.severity.toLowerCase()] ?? f.severity;
          return `<div style="margin:0 0 12px;padding:12px 14px;border:1px solid ${C.border};border-left:3px solid ${severityColor(f.severity)};border-radius:6px;">
<div style="color:${severityColor(f.severity)};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${esc(label)}</div>
<div style="color:${C.text};font-size:14px;font-weight:600;margin-top:2px;">${esc(f.title)}</div>
<div style="color:${C.muted};font-size:13px;margin-top:4px;">${esc(f.description)}</div>
</div>`;
        })
        .join('')}${d.remainingCount > 0 ? `<p style="margin:0;color:${C.muted};font-size:13px;">${esc(t.more(d.remainingCount))}</p>` : ''}`
    : '';

  const text = plainText([
    m.common.hi(d.firstName),
    t.body(d.siteUrl),
    `${t.overall}: ${d.overallScore}`,
    showCategories && rowsText(categories.map(([l, s]) => [l, String(s)] as [string, string])),
    findings.length > 0 &&
      `${t.topFindings}:\n` +
        findings
          .map((f) => `- [${m.severity[f.severity.toLowerCase()] ?? f.severity}] ${f.title}: ${f.description}`)
          .join('\n'),
    d.remainingCount > 0 && t.more(d.remainingCount),
    `${t.cta}: ${d.resultsUrl}`,
  ]);

  return {
    subject: t.subject(d.siteUrl),
    html: layout({
      locale, m,
      title: t.heading,
      greeting: m.common.hi(d.firstName),
      intro: t.body(d.siteUrl),
      bodyHtml: scoreBlock + categoryBlock + findingsBlock,
      cta: { label: t.cta, url: d.resultsUrl },
    }),
    text,
  };
}

// ─── 4. Fix complete ────────────────────────────────────────────────────────

export function renderFix(
  locale: Locale,
  d: {
    firstName: string;
    siteUrl: string;
    fixTitle: string;
    fixCategory: string;
    fixImpact: string;
    fixDescription: string;
    tokensUsed: number;
    tokensRemaining: number;
    cockpitUrl: string;
  },
): RenderedEmail {
  const m = EMAIL_MESSAGES[locale];
  const t = m.fix;
  const rows: Array<[string, string]> = [[t.category, d.fixCategory]];
  if (d.fixImpact) rows.push([t.impact, d.fixImpact]);
  rows.push([t.tokensUsed, formatEmailNumber(d.tokensUsed, locale)]);
  rows.push([t.tokensRemaining, formatEmailNumber(d.tokensRemaining, locale)]);

  const detail = `<p style="margin:20px 0 4px;color:${C.text};font-size:16px;font-weight:600;">${esc(d.fixTitle)}</p>${
    d.fixDescription ? `<p style="margin:0;color:${C.muted};font-size:14px;">${esc(d.fixDescription)}</p>` : ''
  }`;

  return {
    subject: t.subject(d.siteUrl),
    html: layout({
      locale, m,
      title: t.heading,
      greeting: m.common.hi(d.firstName),
      intro: t.body(d.siteUrl),
      bodyHtml: detail + rowsTable(rows),
      cta: { label: t.cta, url: d.cockpitUrl },
    }),
    text: plainText([
      m.common.hi(d.firstName),
      t.body(d.siteUrl),
      d.fixTitle,
      d.fixDescription,
      rowsText(rows),
      `${t.cta}: ${d.cockpitUrl}`,
    ]),
  };
}

// ─── 5. Payment receipt ─────────────────────────────────────────────────────

export function renderReceipt(
  locale: Locale,
  d: {
    firstName: string;
    planName: string;
    amountCents: number;
    currency: string;
    billingDate: Date;
    periodStart: Date;
    periodEnd: Date;
    invoiceNumber: string;
    invoicePdfUrl: string;
    cardBrand: string;
    cardLast4: string;
    nextRenewalDate: Date;
  },
): RenderedEmail {
  const m = EMAIL_MESSAGES[locale];
  const t = m.receipt;
  const rows: Array<[string, string]> = [];
  if (d.invoiceNumber) rows.push([t.invoice, d.invoiceNumber]);
  rows.push([t.date, formatEmailDate(d.billingDate, locale)]);
  rows.push([t.plan, d.planName]);
  rows.push([
    t.period,
    `${formatEmailDate(d.periodStart, locale)} – ${formatEmailDate(d.periodEnd, locale)}`,
  ]);
  rows.push([t.amount, formatEmailAmount(d.amountCents, d.currency, locale)]);
  rows.push([t.card, `${d.cardBrand} •••• ${d.cardLast4}`]);
  rows.push([t.renewal, formatEmailDate(d.nextRenewalDate, locale)]);

  return {
    subject: t.subject,
    html: layout({
      locale, m,
      title: t.heading,
      greeting: m.common.hi(d.firstName),
      intro: t.body,
      bodyHtml: rowsTable(rows),
      cta: d.invoicePdfUrl ? { label: t.download, url: d.invoicePdfUrl } : undefined,
    }),
    text: plainText([
      m.common.hi(d.firstName),
      t.body,
      rowsText(rows),
      d.invoicePdfUrl && `${t.download}: ${d.invoicePdfUrl}`,
    ]),
  };
}
