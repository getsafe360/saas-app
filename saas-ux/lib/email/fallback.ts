// lib/email/fallback.ts
//
// Plain HTML versions of every transactional email.
//
// send.ts sends through Resend's hosted templates, which means the five
// RESEND_TEMPLATE_* IDs must exist in the Resend dashboard before any mail
// goes out. Until they do, the previous behaviour was to log a warning and
// send nothing — so a new customer signing up on launch day would receive no
// welcome mail, no subscription confirmation and no receipt, silently.
//
// These fallbacks are deliberately plain: a single-column table layout, inline
// styles, no images, no web fonts. They render in every client including
// Outlook, and they are meant to be *correct*, not beautiful. Once the branded
// Resend templates exist, setting the env var switches each email over
// individually with no code change.

const BRAND = '#2563eb';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';

function layout(opts: { heading: string; body: string; cta?: { label: string; url: string } }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
<tr><td style="padding:28px 32px 8px;">
  <div style="font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND};letter-spacing:.4px;text-transform:uppercase;">GetSafe 360 AI</div>
  <h1 style="margin:12px 0 0;font:600 21px/1.35 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${opts.heading}</h1>
</td></tr>
<tr><td style="padding:12px 32px 4px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  ${opts.body}
</td></tr>
${
  opts.cta
    ? `<tr><td style="padding:20px 32px 8px;">
  <a href="${opts.cta.url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:13px 22px;border-radius:8px;">${opts.cta.label}</a>
</td></tr>`
    : ''
}
<tr><td style="padding:24px 32px 28px;border-top:1px solid ${BORDER};margin-top:16px;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
  You are receiving this because you have a GetSafe 360 AI account.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function scoreRow(label: string, value: number): string {
  const color = value >= 80 ? '#16a34a' : value >= 50 ? '#ea580c' : '#dc2626';
  return `<tr>
    <td style="padding:6px 0;font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${label}</td>
    <td align="right" style="padding:6px 0;font:600 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${color};">${value}/100</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const fallbackEmails = {
  welcome(opts: { firstName: string; dashboardUrl: string }) {
    return {
      subject: 'Welcome to GetSafe 360 AI',
      html: layout({
        heading: `Welcome, ${escapeHtml(opts.firstName)}`,
        body: `<p style="margin:0 0 12px;">Your account is ready. Add your first website and we will check it for SEO, performance, accessibility and security issues — the analysis is free and unlimited.</p>
               <p style="margin:0;">You will get a summary here as soon as the first scan finishes.</p>`,
        cta: { label: 'Open your dashboard', url: opts.dashboardUrl },
      }),
    };
  },

  subscriptionConfirmation(opts: {
    firstName: string;
    planName: string;
    billingAmount: string;
    billingPeriod: string;
    tokenBalance: string;
    nextRenewalDate: string;
    dashboardUrl: string;
  }) {
    return {
      subject: `Your ${opts.planName} subscription is active`,
      html: layout({
        heading: `${escapeHtml(opts.planName)} is active`,
        body: `<p style="margin:0 0 14px;">Thanks, ${escapeHtml(opts.firstName)} — your subscription is live.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Plan</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.planName)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Billing</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.billingAmount)} / ${escapeHtml(opts.billingPeriod)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Token balance</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.tokenBalance)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Renews</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.nextRenewalDate)}</td></tr>
        </table>`,
        cta: { label: 'Go to dashboard', url: opts.dashboardUrl },
      }),
    };
  },

  scanComplete(opts: {
    firstName: string;
    siteUrl: string;
    overallScore: number;
    seoScore: number;
    perfScore: number;
    secScore: number;
    a11yScore: number;
    findings: Array<{ severity: string; title: string; description: string }>;
    remainingCount: number;
    resultsUrl: string;
  }) {
    const findingsHtml =
      opts.findings.length > 0
        ? `<p style="margin:18px 0 8px;font-weight:600;">Top findings</p><ul style="margin:0;padding-left:20px;">${opts.findings
            .map(
              (f) =>
                `<li style="margin:0 0 8px;"><strong>${escapeHtml(f.title)}</strong> <span style="color:${MUTED};">(${escapeHtml(f.severity)})</span><br>${escapeHtml(f.description)}</li>`
            )
            .join('')}</ul>${
            opts.remainingCount > 0
              ? `<p style="margin:10px 0 0;color:${MUTED};">and ${opts.remainingCount} more.</p>`
              : ''
          }`
        : `<p style="margin:18px 0 0;">We did not find any issues in this pass.</p>`;

    return {
      subject: `Scan complete: ${opts.siteUrl} scored ${opts.overallScore}/100`,
      html: layout({
        heading: `${escapeHtml(opts.siteUrl)} scored ${opts.overallScore}/100`,
        body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(opts.firstName)}, your scan finished.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${scoreRow('SEO', opts.seoScore)}
          ${scoreRow('Performance', opts.perfScore)}
          ${scoreRow('Security', opts.secScore)}
          ${scoreRow('Accessibility', opts.a11yScore)}
        </table>
        ${findingsHtml}`,
        cta: { label: 'View full results', url: opts.resultsUrl },
      }),
    };
  },

  fixComplete(opts: {
    firstName: string;
    siteUrl: string;
    fixTitle: string;
    fixDescription: string;
    tokensUsed: number;
    tokensRemaining: number;
    cockpitUrl: string;
  }) {
    return {
      subject: `Changes applied to ${opts.siteUrl}`,
      html: layout({
        heading: 'Your changes are live',
        body: `<p style="margin:0 0 12px;">Hi ${escapeHtml(opts.firstName)}, we applied the changes you approved to ${escapeHtml(opts.siteUrl)}.</p>
               <p style="margin:0 0 12px;"><strong>${escapeHtml(opts.fixTitle)}</strong><br>${escapeHtml(opts.fixDescription)}</p>
               <p style="margin:0;color:${MUTED};">${opts.tokensUsed.toLocaleString('en')} tokens used · ${opts.tokensRemaining.toLocaleString('en')} remaining.</p>`,
        cta: { label: 'Open site cockpit', url: opts.cockpitUrl },
      }),
    };
  },

  paymentReceipt(opts: {
    firstName: string;
    planName: string;
    billingAmount: string;
    billingDate: string;
    periodStart: string;
    periodEnd: string;
    invoiceNumber: string;
    invoicePdfUrl: string;
    companyAddress: string;
  }) {
    return {
      subject: `Receipt ${opts.invoiceNumber} — GetSafe 360 AI`,
      html: layout({
        heading: `Receipt ${escapeHtml(opts.invoiceNumber)}`,
        body: `<p style="margin:0 0 14px;">Thanks ${escapeHtml(opts.firstName)} — your payment was received.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Plan</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.planName)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Amount</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.billingAmount)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Date</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.billingDate)}</td></tr>
          <tr><td style="padding:6px 0;color:${MUTED};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Period</td><td align="right" style="padding:6px 0;font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">${escapeHtml(opts.periodStart)} – ${escapeHtml(opts.periodEnd)}</td></tr>
        </table>
        <p style="margin:18px 0 0;color:${MUTED};font-size:13px;">${escapeHtml(opts.companyAddress)}</p>`,
        cta: opts.invoicePdfUrl ? { label: 'Download invoice (PDF)', url: opts.invoicePdfUrl } : undefined,
      }),
    };
  },
};
