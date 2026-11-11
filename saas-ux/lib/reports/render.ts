// lib/reports/render.ts
//
// Turns report content into Markdown or a printable HTML page (which the PDF
// is made from). Pure: everything comes in through the arguments.

import { REPORT_CATEGORIES, scoreGrade, type ReportContent, type ReportFix } from './content';
import type { ReportText } from './text';

export interface ReportBrand {
  /** Shown as the author; null leaves the author out (white-label without branding). */
  companyName: string | null;
  /** https logo URL, already checked to be public. */
  logoUrl: string | null;
  primaryColor: string;
  /** Show "Powered by GetSafe 360 AI". */
  poweredBy: boolean;
}

export const DEFAULT_BRAND: ReportBrand = {
  companyName: 'GetSafe 360 AI',
  logoUrl: null,
  primaryColor: '#2563eb',
  poweredBy: true,
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

function whyItMatters(fix: ReportFix, text: ReportText): string {
  if (fix.findingId && text.has(`why.${fix.findingId}`)) return text.t(`why.${fix.findingId}`);
  return text.t('whyFallback');
}

function summaryLines(content: ReportContent, text: ReportText): string[] {
  const lines = [text.t('summary.fixes', { count: content.fixes.length })];
  if (typeof content.scores.overall === 'number') {
    lines.push(text.t('summary.score', { score: content.scores.overall, grade: scoreGrade(content.scores.overall) }));
  }
  const health = content.wordpressHealth;
  if (health && typeof health.now === 'number') {
    lines.push(
      typeof health.before === 'number' && health.before !== health.now
        ? text.t('summary.healthChange', { before: health.before, now: health.now })
        : text.t('summary.health', { now: health.now }),
    );
  }
  lines.push(text.t('summary.open', { count: content.openIssues.length }));
  return lines;
}

function periodLabel(content: ReportContent, text: ReportText): string {
  return text.t('period', { from: text.date(content.periodStart), to: text.date(content.generatedAt) });
}

// ---------- Markdown ----------

const mdCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function renderMarkdown(content: ReportContent, text: ReportText, brand: ReportBrand): string {
  const out: string[] = [];
  out.push(`# ${text.t('title')}`, '');
  out.push(`**${content.site.host}** · ${periodLabel(content, text)}  `);
  out.push(
    brand.companyName
      ? `${text.t('preparedBy', { company: brand.companyName })} · ${text.t('generatedOn', { date: text.date(content.generatedAt) })}`
      : text.t('generatedOn', { date: text.date(content.generatedAt) }),
    '',
  );

  out.push(`## ${text.t('summary.heading')}`, '');
  for (const line of summaryLines(content, text)) out.push(`- ${line}`);
  out.push('');

  out.push(`## ${text.t('scores.heading')}`, '');
  out.push(`| ${text.t('scores.category')} | ${text.t('scores.score')} | ${text.t('scores.grade')} |`, '|---|---:|:---:|');
  out.push(`| **${text.t('scores.overall')}** | **${content.scores.overall ?? '–'}** | **${scoreGrade(content.scores.overall)}** |`);
  for (const category of REPORT_CATEGORIES) {
    const score = content.scores[category];
    if (score === undefined) continue;
    out.push(`| ${text.t(`categories.${category}`)} | ${score ?? '–'} | ${scoreGrade(score)} |`);
  }
  out.push('');

  out.push(`## ${text.t('fixed.heading')}`, '');
  if (content.fixes.length === 0) {
    out.push(text.t('fixed.none'), '');
  } else {
    out.push(text.t('fixed.intro'), '');
    out.push(`| ${text.t('fixed.date')} | ${text.t('fixed.change')} | ${text.t('fixed.why')} |`, '|---|---|---|');
    for (const fix of content.fixes) {
      const title = text.findingTitle(fix.findingId, fix.title) + (fix.unverified ? ` (${text.t('fixed.unverified')})` : '');
      out.push(`| ${text.date(fix.appliedAt)} | ${mdCell(title)} | ${mdCell(whyItMatters(fix, text))} |`);
    }
    out.push('', `_${text.t('fixed.undoNote')}_`, '');
  }

  if (content.cspTestSince) {
    out.push(`## ${text.t('protection.heading')}`, '');
    out.push(`- ${text.t('protection.csp', { date: text.date(content.cspTestSince) })}`, '');
  }

  out.push(`## ${text.t('next.heading')}`, '');
  if (content.openIssues.length === 0) {
    out.push(text.t('next.none'), '');
  } else {
    content.openIssues.forEach((issue, index) => {
      const title = text.findingTitle(issue.id, issue.title ?? issue.id);
      const recommendation = text.findingRecommendation(issue.id);
      out.push(
        `${index + 1}. **${title}** (${text.t(`severity.${issue.severity}`)})${recommendation ? ` — ${recommendation}` : ''}`,
      );
    });
    out.push('');
  }

  out.push('---', '', `_${text.t('footer.method', { date: text.date(content.generatedAt) })}_`);
  if (brand.poweredBy) out.push('', `_${text.t('footer.poweredBy')}_`);
  return out.join('\n') + '\n';
}

// ---------- HTML (for PDF) ----------

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function scoreColor(score: number | null | undefined): string {
  if (typeof score !== 'number') return '#9ca3af';
  if (score >= 90) return '#059669';
  if (score >= 70) return '#d97706';
  return '#dc2626';
}

export function renderHtml(content: ReportContent, text: ReportText, brand: ReportBrand): string {
  const color = SAFE_COLOR.test(brand.primaryColor) ? brand.primaryColor : DEFAULT_BRAND.primaryColor;
  const t = (key: string, values?: Record<string, string | number | Date>) => esc(text.t(key, values));

  const scoreRows = REPORT_CATEGORIES.filter((category) => content.scores[category] !== undefined)
    .map((category) => {
      const score = content.scores[category] ?? null;
      return `<tr><td>${t(`categories.${category}`)}</td><td class="num" style="color:${scoreColor(score)}">${score ?? '–'}</td><td class="num">${esc(scoreGrade(score))}</td></tr>`;
    })
    .join('');

  const fixRows = content.fixes
    .map(
      (fix) => `<tr>
        <td class="date">${esc(text.date(fix.appliedAt))}</td>
        <td><strong>${esc(text.findingTitle(fix.findingId, fix.title))}</strong>${fix.unverified ? `<div class="note">${t('fixed.unverified')}</div>` : ''}</td>
        <td>${esc(whyItMatters(fix, text))}</td>
      </tr>`,
    )
    .join('');

  const nextItems = content.openIssues
    .map((issue) => {
      const recommendation = text.findingRecommendation(issue.id);
      return `<li><span class="sev sev-${issue.severity}">${t(`severity.${issue.severity}`)}</span> <strong>${esc(text.findingTitle(issue.id, issue.title ?? issue.id))}</strong>${recommendation ? `<div class="rec">${esc(recommendation)}</div>` : ''}</li>`;
    })
    .join('');

  const health = content.wordpressHealth;

  return `<!DOCTYPE html>
<html lang="${text.locale}">
<head>
<meta charset="utf-8">
<title>${t('title')} · ${esc(content.site.host)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${color}; padding-bottom: 10px; margin-bottom: 18px; }
  header img { max-height: 40px; max-width: 180px; }
  .company { font-weight: 600; font-size: 11pt; }
  .meta { text-align: right; color: #6b7280; font-size: 9pt; }
  h1 { color: ${color}; font-size: 20pt; margin: 0 0 2px; }
  .site { font-size: 12pt; font-weight: 600; }
  .period { color: #6b7280; margin-bottom: 18px; }
  h2 { font-size: 12.5pt; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 22px 0 10px; page-break-after: avoid; }
  .summary { display: flex; gap: 16px; align-items: stretch; }
  .score { min-width: 120px; border: 1px solid #e5e7eb; border-radius: 10px; text-align: center; padding: 12px; }
  .score .value { font-size: 30pt; font-weight: 700; line-height: 1; }
  .score .grade { font-size: 13pt; font-weight: 600; color: ${color}; }
  .score .label { color: #6b7280; font-size: 8.5pt; margin-top: 4px; }
  ul.points { margin: 0; padding-left: 18px; }
  ul.points li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr { page-break-inside: avoid; }
  td.num, th.num { text-align: right; font-weight: 600; }
  td.date { white-space: nowrap; color: #6b7280; width: 1%; }
  .note { color: #b45309; font-size: 8.5pt; }
  .muted { color: #6b7280; }
  ol.next { padding-left: 0; list-style: none; margin: 0; }
  ol.next li { padding: 7px 0; border-bottom: 1px solid #f3f4f6; page-break-inside: avoid; }
  .rec { color: #4b5563; margin-top: 2px; }
  .sev { display: inline-block; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; border-radius: 4px; padding: 1px 5px; margin-right: 4px; }
  .sev-critical, .sev-high { background: #fee2e2; color: #b91c1c; }
  .sev-medium { background: #fef3c7; color: #92400e; }
  .sev-low { background: #e5e7eb; color: #374151; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 8.5pt; }
</style>
</head>
<body>
<header>
  <div>${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="">` : ''}${brand.companyName ? `<div class="company">${esc(brand.companyName)}</div>` : ''}</div>
  <div class="meta">${t('generatedOn', { date: text.date(content.generatedAt) })}</div>
</header>

<h1>${t('title')}</h1>
<div class="site">${esc(content.site.host)}</div>
<div class="period">${esc(periodLabel(content, text))}</div>

<h2>${t('summary.heading')}</h2>
<div class="summary">
  <div class="score">
    <div class="value" style="color:${scoreColor(content.scores.overall)}">${content.scores.overall ?? '–'}</div>
    <div class="grade">${esc(scoreGrade(content.scores.overall))}</div>
    <div class="label">${t('scores.overall')}</div>
  </div>
  ${
    health && typeof health.now === 'number'
      ? `<div class="score"><div class="value" style="color:${scoreColor(health.now)}">${health.now}</div><div class="grade">${typeof health.before === 'number' && health.before !== health.now ? `${health.before} → ${health.now}` : esc(scoreGrade(health.now))}</div><div class="label">${t('scores.wordpress')}</div></div>`
      : ''
  }
  <ul class="points">${summaryLines(content, text).map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
</div>

<h2>${t('scores.heading')}</h2>
<table><thead><tr><th>${t('scores.category')}</th><th class="num">${t('scores.score')}</th><th class="num">${t('scores.grade')}</th></tr></thead><tbody>${scoreRows}</tbody></table>

<h2>${t('fixed.heading')}</h2>
${
  content.fixes.length === 0
    ? `<p class="muted">${t('fixed.none')}</p>`
    : `<p>${t('fixed.intro')}</p><table><thead><tr><th>${t('fixed.date')}</th><th>${t('fixed.change')}</th><th>${t('fixed.why')}</th></tr></thead><tbody>${fixRows}</tbody></table><p class="muted">${t('fixed.undoNote')}</p>`
}

${content.cspTestSince ? `<h2>${t('protection.heading')}</h2><p>${t('protection.csp', { date: text.date(content.cspTestSince) })}</p>` : ''}

<h2>${t('next.heading')}</h2>
${content.openIssues.length === 0 ? `<p class="muted">${t('next.none')}</p>` : `<ol class="next">${nextItems}</ol>`}

<footer>
  <div>${t('footer.method', { date: text.date(content.generatedAt) })}</div>
  ${brand.poweredBy ? `<div>${t('footer.poweredBy')}</div>` : ''}
</footer>
</body>
</html>`;
}
