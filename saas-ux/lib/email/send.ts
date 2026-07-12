import 'server-only';
import { getResend, FROM, BASE_URL } from './client';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#fb923c';
  return '#f87171';
}

function fmtDate(d: Date | number): string {
  return new Date(typeof d === 'number' ? d * 1000 : d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtAmount(cents: number, currency = 'eur'): string {
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Fire-and-forget wrapper — email never takes down the calling route. */
async function send(payload: Parameters<ReturnType<typeof getResend>['emails']['send']>[0]) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send(payload);
    if (error) console.error('[email] send error', error);
  } catch (err) {
    console.error('[email] unexpected error', err);
  }
}

// ─── Template IDs (set these to your Resend template IDs) ───────────────────
// Find them in Resend dashboard → Emails → Templates → click template → copy ID
const TEMPLATE = {
  welcome:                  process.env.RESEND_TEMPLATE_WELCOME,
  subscription_confirmation: process.env.RESEND_TEMPLATE_SUBSCRIPTION,
  scan_complete:            process.env.RESEND_TEMPLATE_SCAN_COMPLETE,
  fix_complete:             process.env.RESEND_TEMPLATE_FIX_COMPLETE,
  payment_receipt:          process.env.RESEND_TEMPLATE_PAYMENT_RECEIPT,
} as const;

// ─── 1. Welcome ──────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  firstName: string;
}) {
  const templateId = TEMPLATE.welcome;
  if (!templateId) {
    console.warn('[email] RESEND_TEMPLATE_WELCOME not set — skipping welcome email');
    return;
  }
  await send({
    from: FROM,
    to: opts.to,
    subject: 'Welcome to GetSafe360 AI',
    react: undefined as any,      // using Resend template, not React
    templateId,
    variables: {
      first_name: opts.firstName,
      dashboard_url: `${BASE_URL}/en/dashboard/`,
    },
  } as any);
}

// ─── 2. Subscription Confirmation ────────────────────────────────────────────

export async function sendSubscriptionConfirmationEmail(opts: {
  to: string;
  firstName: string;
  planName: string;
  billingAmount: string;      // e.g. "€19.00"
  billingPeriod: string;      // e.g. "month"
  tokenBalance: string;       // e.g. "10,000"
  nextRenewalDate: string;    // formatted
}) {
  const templateId = TEMPLATE.subscription_confirmation;
  if (!templateId) {
    console.warn('[email] RESEND_TEMPLATE_SUBSCRIPTION not set — skipping');
    return;
  }
  await send({
    from: FROM,
    to: opts.to,
    subject: `Your ${opts.planName} plan is active`,
    templateId,
    variables: {
      first_name:          opts.firstName,
      plan_name:           opts.planName,
      billing_amount:      opts.billingAmount,
      billing_period:      opts.billingPeriod,
      token_balance:       opts.tokenBalance,
      next_renewal_date:   opts.nextRenewalDate,
    },
  } as any);
}

// ─── 3. Scan Complete ─────────────────────────────────────────────────────────

export interface ScanFinding {
  severity: string;   // "Critical" | "High" | "Medium"
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
  topFindings: ScanFinding[];   // pass up to 3
  remainingCount: number;
}) {
  const templateId = TEMPLATE.scan_complete;
  if (!templateId) {
    console.warn('[email] RESEND_TEMPLATE_SCAN_COMPLETE not set — skipping');
    return;
  }

  const [f1, f2, f3] = opts.topFindings;
  const scanUrl = `${BASE_URL}/en/dashboard/sites/${opts.siteId}`;

  await send({
    from: FROM,
    to: opts.to,
    subject: `Your ${opts.siteUrl} scan is ready`,
    templateId,
    variables: {
      first_name:               opts.firstName,
      site_url:                 opts.siteUrl,
      overall_score:            String(opts.overallScore),
      seo_score:                String(opts.seoScore),
      seo_color:                scoreColor(opts.seoScore),
      perf_score:               String(opts.perfScore),
      perf_color:               scoreColor(opts.perfScore),
      sec_score:                String(opts.secScore),
      sec_color:                scoreColor(opts.secScore),
      a11y_score:               String(opts.a11yScore),
      a11y_color:               scoreColor(opts.a11yScore),
      finding_1_severity:       f1?.severity ?? '',
      finding_1_title:          f1?.title ?? '',
      finding_1_description:    f1?.description ?? '',
      finding_2_severity:       f2?.severity ?? '',
      finding_2_title:          f2?.title ?? '',
      finding_2_description:    f2?.description ?? '',
      finding_3_severity:       f3?.severity ?? '',
      finding_3_title:          f3?.title ?? '',
      finding_3_description:    f3?.description ?? '',
      remaining_findings_count: String(opts.remainingCount),
      scan_results_url:         scanUrl,
    },
  } as any);
}

// ─── 4. Fix Complete ──────────────────────────────────────────────────────────

export async function sendFixCompleteEmail(opts: {
  to: string;
  firstName: string;
  siteUrl: string;
  siteId: string;
  fixTitle: string;
  fixCategory: string;
  fixImpact: string;        // e.g. "+8 pts"
  fixDescription: string;
  tokensUsed: number;
  tokensRemaining: number;
}) {
  const templateId = TEMPLATE.fix_complete;
  if (!templateId) {
    console.warn('[email] RESEND_TEMPLATE_FIX_COMPLETE not set — skipping');
    return;
  }
  await send({
    from: FROM,
    to: opts.to,
    subject: `Fix applied to ${opts.siteUrl}`,
    templateId,
    variables: {
      first_name:        opts.firstName,
      site_url:          opts.siteUrl,
      fix_title:         opts.fixTitle,
      fix_category:      opts.fixCategory,
      fix_impact:        opts.fixImpact,
      fix_description:   opts.fixDescription,
      tokens_used:       opts.tokensUsed.toLocaleString('en'),
      tokens_remaining:  opts.tokensRemaining.toLocaleString('en'),
      site_cockpit_url:  `${BASE_URL}/en/dashboard/sites/${opts.siteId}`,
    },
  } as any);
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
}) {
  const templateId = TEMPLATE.payment_receipt;
  if (!templateId) {
    console.warn('[email] RESEND_TEMPLATE_PAYMENT_RECEIPT not set — skipping');
    return;
  }
  const amount = fmtAmount(opts.billingAmountCents, opts.billingCurrency);
  await send({
    from: FROM,
    to: opts.to,
    subject: `Receipt — ${amount} received`,
    templateId,
    variables: {
      first_name:         opts.firstName,
      billing_name:       opts.billingName,
      billing_email:      opts.to,
      billing_company:    opts.billingCompany ?? '',
      plan_name:          opts.planName,
      billing_amount:     amount,
      billing_period:     'monthly',
      billing_date:       fmtDate(opts.billingDate),
      period_start:       fmtDate(opts.periodStart),
      period_end:         fmtDate(opts.periodEnd),
      invoice_number:     opts.invoiceNumber,
      invoice_pdf_url:    opts.invoicePdfUrl,
      card_brand:         opts.cardBrand,
      card_last4:         opts.cardLast4,
      next_renewal_date:  fmtDate(opts.nextRenewalDate),
      company_address:    process.env.COMPANY_ADDRESS ?? '',
    },
  } as any);
}
