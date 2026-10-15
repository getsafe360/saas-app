import 'server-only';
import { getResend, FROM, BASE_URL } from './client';
import {
  formatEmailAmount,
  formatEmailDate,
  formatEmailNumber,
  renderFix,
  renderReceipt,
  renderScan,
  renderSubscription,
  renderWelcome,
  resolveEmailLocale,
  type RenderedEmail,
} from './render';

// Every send function takes an optional `language` (the recipient's
// users.language). Empty or unsupported values fall back to English.

/** Fire-and-forget wrapper — email never takes down the calling route. */
async function send(to: string, email: RenderedEmail) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) console.error('[email] send error', error);
  } catch (err) {
    console.error('[email] unexpected error', err);
  }
}

// ─── 1. Welcome ──────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  firstName: string;
  language?: string | null;
}) {
  const locale = resolveEmailLocale(opts.language);
  await send(
    opts.to,
    renderWelcome(locale, {
      firstName: opts.firstName,
      dashboardUrl: `${BASE_URL}/${locale}/dashboard`,
    }),
  );
}

// ─── 2. Subscription Confirmation ────────────────────────────────────────────

export async function sendSubscriptionConfirmationEmail(opts: {
  to: string;
  firstName: string;
  planName: string;
  /** Amount in minor units, with its ISO currency; omitted if unknown. */
  billingAmountCents?: number | null;
  billingCurrency?: string | null;
  billingPeriod: 'month' | 'year';
  tokensIncluded: number;
  nextRenewalDate?: Date | null;
  language?: string | null;
}) {
  const locale = resolveEmailLocale(opts.language);
  await send(
    opts.to,
    renderSubscription(locale, {
      firstName: opts.firstName,
      planName: opts.planName,
      billingAmount:
        opts.billingAmountCents != null && opts.billingCurrency
          ? formatEmailAmount(opts.billingAmountCents, opts.billingCurrency, locale)
          : '',
      billingPeriod: opts.billingPeriod,
      tokenBalance: opts.tokensIncluded > 0 ? formatEmailNumber(opts.tokensIncluded, locale) : '',
      nextRenewalDate: opts.nextRenewalDate ? formatEmailDate(opts.nextRenewalDate, locale) : '',
      dashboardUrl: `${BASE_URL}/${locale}/dashboard`,
    }),
  );
}

// ─── 3. Scan Complete ─────────────────────────────────────────────────────────

export interface ScanFinding {
  severity: string;
  title: string;
  description: string;
}

export async function sendScanCompleteEmail(opts: {
  to: string;
  firstName: string;
  siteUrl: string;
  siteId: string;
  overallScore: number;
  seoScore: number;
  perfScore: number;
  secScore: number;
  a11yScore: number;
  topFindings: ScanFinding[];
  remainingCount: number;
  language?: string | null;
}) {
  const locale = resolveEmailLocale(opts.language);
  await send(
    opts.to,
    renderScan(locale, {
      firstName: opts.firstName,
      siteUrl: opts.siteUrl,
      overallScore: opts.overallScore,
      seoScore: opts.seoScore,
      perfScore: opts.perfScore,
      secScore: opts.secScore,
      a11yScore: opts.a11yScore,
      topFindings: opts.topFindings.slice(0, 3),
      remainingCount: opts.remainingCount,
      resultsUrl: `${BASE_URL}/${locale}/dashboard/sites/${opts.siteId}`,
    }),
  );
}

// ─── 4. Fix Complete ──────────────────────────────────────────────────────────

export async function sendFixCompleteEmail(opts: {
  to: string;
  firstName: string;
  siteUrl: string;
  siteId: string;
  fixTitle: string;
  fixCategory: string;
  fixImpact: string;
  fixDescription: string;
  tokensUsed: number;
  tokensRemaining: number;
  language?: string | null;
}) {
  const locale = resolveEmailLocale(opts.language);
  await send(
    opts.to,
    renderFix(locale, {
      firstName: opts.firstName,
      siteUrl: opts.siteUrl,
      fixTitle: opts.fixTitle,
      fixCategory: opts.fixCategory,
      fixImpact: opts.fixImpact,
      fixDescription: opts.fixDescription,
      tokensUsed: opts.tokensUsed,
      tokensRemaining: opts.tokensRemaining,
      cockpitUrl: `${BASE_URL}/${locale}/dashboard/sites/${opts.siteId}`,
    }),
  );
}

// ─── 5. Payment Receipt ───────────────────────────────────────────────────────

export async function sendPaymentReceiptEmail(opts: {
  to: string;
  firstName: string;
  billingName: string;
  billingCompany?: string;
  planName: string;
  billingAmountCents: number;
  billingCurrency: string;
  billingDate: Date;
  periodStart: Date;
  periodEnd: Date;
  invoiceNumber: string;
  invoicePdfUrl: string;
  cardBrand: string;
  cardLast4: string;
  nextRenewalDate: Date;
  language?: string | null;
}) {
  const locale = resolveEmailLocale(opts.language);
  await send(
    opts.to,
    renderReceipt(locale, {
      firstName: opts.firstName,
      planName: opts.planName,
      amountCents: opts.billingAmountCents,
      currency: opts.billingCurrency,
      billingDate: opts.billingDate,
      periodStart: opts.periodStart,
      periodEnd: opts.periodEnd,
      invoiceNumber: opts.invoiceNumber,
      invoicePdfUrl: opts.invoicePdfUrl,
      cardBrand: opts.cardBrand,
      cardLast4: opts.cardLast4,
      nextRenewalDate: opts.nextRenewalDate,
    }),
  );
}
