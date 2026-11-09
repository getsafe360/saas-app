import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { IntlMessageFormat } from 'intl-messageformat';

import { hasMessage, messageKey, renderMessage } from './messages';
import { EMAIL_DNS_RULES } from './security/email-dns';
import { SECURITY_HEADER_RULES } from './security/headers';
import { WORDPRESS_RULES } from './wordpress/rules';
import { PAGE_RULES } from './page/rules';

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
const root = path.resolve(__dirname, '../..');

type Catalog = Record<string, Record<string, string>>;
const catalogs = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    (JSON.parse(readFileSync(path.join(root, 'messages/Findings', `${locale}.json`), 'utf8')) as { Findings: Catalog })
      .Findings,
  ]),
) as Record<(typeof LOCALES)[number], Catalog>;

const ALL_RULES = [...WORDPRESS_RULES, ...SECURITY_HEADER_RULES, ...EMAIL_DNS_RULES, ...PAGE_RULES];

/** Argument names in an ICU message, including nested plural/select branches. */
function argumentsOf(message: string, locale: string): string[] {
  // Parse with tags enabled, as next-intl does in the browser: a stray "<" must fail here.
  const ast = new IntlMessageFormat(message, locale).getAst();
  const names = new Set<string>();
  const walk = (nodes: any[]) => {
    for (const node of nodes) {
      if (typeof node.value === 'string' && node.type !== 0) names.add(node.value);
      if (node.options) for (const option of Object.values<any>(node.options)) walk(option.value);
      if (node.children) walk(node.children);
    }
  };
  walk(ast as any[]);
  return [...names].sort();
}

test('every locale has exactly the English keys', () => {
  const englishKeys = Object.entries(catalogs.en).flatMap(([group, entries]) =>
    Object.keys(entries).map((key) => `${group}.${key}`),
  );
  for (const locale of LOCALES) {
    const keys = Object.entries(catalogs[locale]).flatMap(([group, entries]) =>
      Object.keys(entries).map((key) => `${group}.${key}`),
    );
    assert.deepEqual(keys.sort(), [...englishKeys].sort(), `${locale} keys differ from en`);
  }
});

test('every message parses and uses the same placeholders as English', () => {
  for (const [group, entries] of Object.entries(catalogs.en)) {
    for (const [key, english] of Object.entries(entries)) {
      const expected = argumentsOf(english, 'en');
      for (const locale of LOCALES) {
        const message = catalogs[locale][group][key];
        assert.deepEqual(argumentsOf(message, locale), expected, `${locale} ${group}.${key}`);
      }
    }
  }
});

test('every rule has a title and recommendation', () => {
  for (const rule of ALL_RULES) {
    assert.ok(hasMessage(`${rule.id}.title`), `${rule.id}.title`);
    assert.ok(hasMessage(`${rule.id}.recommendation`), `${rule.id}.recommendation`);
  }
});

test('every message a rule can emit exists in the catalog', () => {
  const sources = [
    'lib/engine/wordpress/rules.ts',
    'lib/engine/wordpress/audit-rules.ts',
    'lib/engine/security/headers.ts',
    'lib/engine/security/email-dns.ts',
    'lib/engine/page/rules.ts',
  ];
  const ruleIds = new Set(ALL_RULES.map((rule) => rule.id));
  const used = new Set<string>();

  for (const file of sources) {
    const source = readFileSync(path.join(root, file), 'utf8');
    // Rule blocks start at `id: '...'`; every quoted key in a message/unknown call belongs to it.
    const blocks = source.split(/\n\s+id: '/).slice(1);
    for (const block of blocks) {
      const id = block.slice(0, block.indexOf("'"));
      if (!ruleIds.has(id)) continue;
      const keys = [
        // `message: 'key'` or `message: cond ? 'a' : 'b'`
        ...[...block.matchAll(/message: (?:[^?,\n]*\?\s*)?'([\w.]+)'(?:\s*:\s*'([\w.]+)')?/g)].flatMap((m) =>
          [m[1], m[2]].filter(Boolean),
        ),
        ...[...block.matchAll(/unknown\('([\w.]+)'/g)].map((m) => m[1]),
        ...(block.includes('healthyWhenTrue(') ? ['pass', 'fail'] : []),
        ...(block.includes('NOT_REPORTED') ? ['common.notReported'] : []),
        ...(block.includes('NEEDS_AUDIT') ? ['common.needsAudit'] : []),
        ...(block.includes('NEEDS_PLUGIN_17') ? ['common.needsPlugin17'] : []),
        ...(block.includes('NOT_WORDPRESS') ? ['common.notWordPress'] : []),
        ...(block.includes('NO_TITLE') ? ['common.noTitle'] : []),
        ...(block.includes('NO_DESCRIPTION') ? ['common.noDescription'] : []),
      ];
      for (const key of keys) {
        const full = messageKey(id, key);
        used.add(full);
        assert.ok(hasMessage(full), `${file}: ${id} emits missing message "${full}"`);
      }
    }
  }

  // Header rules are generated from one spec list, so check their shared outcomes per rule.
  for (const rule of SECURITY_HEADER_RULES) {
    assert.ok(hasMessage(`${rule.id}.missing`), `${rule.id}.missing`);
    used.add(`${rule.id}.missing`);
  }
  // Header-specific branches in headers.ts, and the runner's fallback for a throwing rule.
  for (const key of [
    'common.headerSet',
    'sec-hsts.httpsUnknown',
    'sec-hsts.notApplicable',
    'sec-frame-options.frameAncestors',
    'common.notEvaluated',
  ]) {
    assert.ok(hasMessage(key), key);
    used.add(key);
  }

  // And the reverse: no outcome text in the catalog that no rule can produce.
  const unused = Object.entries(catalogs.en)
    .flatMap(([group, entries]) => Object.keys(entries).map((key) => `${group}.${key}`))
    .filter((key) => !/\.(title|recommendation)$/.test(key) && !used.has(key));
  assert.deepEqual(unused, []);
});

test('the English renderer formats plurals and placeholders', () => {
  assert.equal(renderMessage('wp-outdated-plugins.outdated', { count: 1 }), '1 plugin has an update available.');
  assert.equal(renderMessage('wp-outdated-plugins.outdated', { count: 3 }), '3 plugins have updates available.');
  assert.equal(renderMessage('wp-expired-transients.many', { count: 12500 }), '12,500 expired transients are still stored.');
  assert.equal(
    renderMessage('email-dmarc.enforced', { policy: 'reject', inherited: 'yes', source: 'example.com' }),
    'DMARC policy is "reject" (inherited from example.com).',
  );
  assert.equal(renderMessage('email-dmarc.enforced', { policy: 'reject', inherited: 'no', source: '' }), 'DMARC policy is "reject".');
  assert.equal(renderMessage('missing.key'), 'missing.key');
});

test('evaluated findings carry their message keys', async () => {
  const { evaluateRules } = await import('./rules');
  const [finding] = evaluateRules(EMAIL_DNS_RULES.slice(0, 1), {
    domain: 'example.com',
    spf: [],
    dmarc: null,
    dmarcSource: null,
  });
  assert.equal(finding.title, 'SPF record');
  assert.equal(finding.summary, 'example.com has no SPF record, so anyone can send email that claims to come from it.');
  assert.deepEqual(finding.messages, {
    title: 'email-spf.title',
    summary: 'email-spf.missing',
    values: { domain: 'example.com' },
    recommendation: 'email-spf.recommendation',
  });
});
