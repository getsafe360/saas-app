import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { IntlMessageFormat } from 'intl-messageformat';
import { AUTOMATIC_FIXER_IDS } from '@/lib/engine/fixers/catalog';
import { WORDPRESS_RULES } from '@/lib/engine/wordpress/rules';
import { SECURITY_HEADER_RULES } from '@/lib/engine/security/headers';
import type { AppliedChange } from '@/lib/wordpress/applied-changes';
import { buildReportContent, reportFilename } from './content';
import { DEFAULT_BRAND, renderHtml, renderMarkdown } from './render';
import { REPORT_LOCALES, reportText } from './text';

const root = path.resolve(__dirname, '../..');
const load = (dir: string, locale: string) => JSON.parse(readFileSync(path.join(root, 'messages', dir, `${locale}.json`), 'utf8'));
const textFor = (locale: (typeof REPORT_LOCALES)[number]) =>
  reportText(locale, load('Reports', locale).Reports, load('Findings', locale).Findings);

const now = new Date('2026-11-11T10:00:00Z');
const change = (overrides: Partial<AppliedChange>): AppliedChange => ({
  runId: 'r', actionId: 'wordpress-disable-xmlrpc', findingIds: ['wp-xmlrpc'], title: 'Disable XML-RPC',
  state: 'active', appliedAt: '2026-11-01T09:00:00Z', undoneAt: null, undoable: true, permanent: false, ...overrides,
});

const content = buildReportContent({
  site: { host: 'sk-rent.de', url: 'https://sk-rent.de/' },
  generatedAt: now,
  periodDays: 30,
  scores: { overall: 89, performance: 96, security: 81, seo: 92, accessibility: 100, content: 100 },
  wordpressHealth: { before: 62, now: 88 },
  changes: [
    change({ runId: 'a' }),
    change({ runId: 'b', findingIds: ['sec-referrer-policy'], title: 'Security headers', state: 'unverified', appliedAt: '2026-11-03T09:00:00Z' }),
    change({ runId: 'c', state: 'undone' }),
    change({ runId: 'd', appliedAt: '2026-08-01T09:00:00Z' }),
  ],
  openIssues: [
    { id: 'sec-version-disclosure', severity: 'low' },
    { id: 'wp-xmlrpc', severity: 'medium' },
    { id: 'sec-csp', severity: 'medium' },
  ],
  cspTestSince: new Date('2026-11-05T00:00:00Z'),
});

test('a grouped change lists every finding it fixed, and none of them stays open', () => {
  const grouped = buildReportContent({
    site: { host: 'x.de', url: 'https://x.de/' }, generatedAt: now, periodDays: 30, scores: { overall: 90 },
    wordpressHealth: null, cspTestSince: null,
    changes: [change({ actionId: 'security-headers', findingIds: ['sec-nosniff', 'sec-frame-options'], title: 'Security headers' })],
    openIssues: [{ id: 'sec-frame-options', severity: 'medium' }, { id: 'sec-csp', severity: 'medium' }],
  });
  assert.deepEqual(grouped.fixes.map((fix) => fix.findingId), ['sec-nosniff', 'sec-frame-options']);
  assert.deepEqual(grouped.openIssues.map((issue) => issue.id), ['sec-csp']);
});

test('only an embedded image can appear as the logo', () => {
  const remote = renderHtml(content, textFor('en'), { ...DEFAULT_BRAND, logoUrl: 'https://169.254.169.254/logo.png' });
  assert.doesNotMatch(remote, /<img/);
  const embedded = renderHtml(content, textFor('en'), { ...DEFAULT_BRAND, logoUrl: 'data:image/png;base64,AAAA' });
  assert.match(embedded, /<img src="data:image\/png;base64,AAAA"/);
});

test('keeps changes from the period that are still in place, oldest first', () => {
  assert.deepEqual(content.fixes.map((fix) => fix.findingId), ['wp-xmlrpc', 'sec-referrer-policy']);
  assert.equal(content.fixes[1].unverified, true);
});

test('a fixed finding is not listed as open, and open issues are ordered by severity', () => {
  assert.deepEqual(content.openIssues.map((issue) => issue.id), ['sec-csp', 'sec-version-disclosure']);
});

test('markdown report in German says what was fixed and why', () => {
  const md = renderMarkdown(content, textFor('de'), DEFAULT_BRAND);
  assert.match(md, /^# Website-Pflegebericht/);
  assert.match(md, /2 Verbesserungen in diesem Zeitraum/);
  assert.match(md, /WordPress-Zustand: 62 → 88\/100/);
  assert.match(md, /Schließt eine alte Schnittstelle/);
  assert.match(md, /Content-Security-Policy im Nur-Bericht-Modus/);
  assert.match(md, /Bereitgestellt von GetSafe 360 AI/);
});

test('white-label leaves GetSafe 360 out and escapes HTML', () => {
  const brand = { companyName: 'Agentur <Berlin>', logoUrl: null, primaryColor: 'red;}', poweredBy: false };
  const html = renderHtml(content, textFor('fr'), brand);
  assert.doesNotMatch(html, /GetSafe 360/);
  assert.match(html, /Agentur &lt;Berlin&gt;/);
  assert.match(html, /#2563eb/);
  assert.match(html, /<html lang="fr">/);
  assert.doesNotMatch(renderMarkdown(content, textFor('fr'), brand), /GetSafe 360/);
});

test('every automatic fix has a "why it matters" in every language, and all messages parse', () => {
  const automatic = [...WORDPRESS_RULES, ...SECURITY_HEADER_RULES]
    .filter((rule) => rule.fix && AUTOMATIC_FIXER_IDS.has(rule.fix.fixerId))
    .map((rule) => rule.id);
  const reference = load('Reports', 'en').Reports;
  const keys = (node: any, prefix = ''): string[] =>
    Object.entries(node).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
  for (const locale of REPORT_LOCALES) {
    const catalog = load('Reports', locale).Reports;
    for (const id of [...automatic, 'sec-csp']) assert.equal(typeof catalog.document.why[id], 'string', `${locale}: why.${id}`);
    assert.deepEqual(keys(catalog).sort(), keys(reference).sort(), locale);
    for (const key of keys(catalog)) {
      const message = key.split('.').reduce((node: any, part) => node[part], catalog);
      new IntlMessageFormat(message, locale).getAst();
    }
    // Renders without missing-message errors in every language.
    renderMarkdown(content, textFor(locale), DEFAULT_BRAND);
  }
});

test('file names are safe and dated', () => {
  assert.equal(reportFilename('www.sk-rent.de', now, 'pdf'), 'sk-rent.de-report-2026-11-11.pdf');
  assert.equal(reportFilename('a/b', now, 'markdown'), 'a-b-report-2026-11-11.md');
});
