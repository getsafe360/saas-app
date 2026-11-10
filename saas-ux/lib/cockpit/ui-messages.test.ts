import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { IntlMessageFormat } from 'intl-messageformat';
import { FOCUS_CATEGORIES } from './focus';
import { PAIRING_MESSAGE_KEYS } from '../wordpress/pairing-messages';
import { RECOMMENDATIONS, SIGNALS, VERDICTS } from '../wordpress/core-review';

const root = path.resolve(__dirname, '../..');
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
const catalogs = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(path.join(root, 'messages/SiteCockpit', `${locale}.json`), 'utf8')).SiteCockpit,
  ]),
);

function lookup(catalog: any, key: string): unknown {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog);
}

/** Component → the namespace its `t` is bound to. */
const COMPONENTS: Array<[file: string, namespace: string]> = [
  ['components/site-cockpit/CategoryFocusTabs.tsx', ''],
  ['components/site-cockpit/OverallScoreHero.tsx', ''],
  ['components/site-cockpit/NextStepBanner.tsx', 'nextStep.'],
  ['components/site-cockpit/SiteCockpit.tsx', ''],
  ['components/site-cockpit/cards/CockpitCard.tsx', ''],
  ['components/site-cockpit/cards/wordpress/WordPressCard.tsx', ''],
  ['components/site-cockpit/cards/wordpress/components/Analysis/SecurityOverview.tsx', ''],
  ['components/site-cockpit/cards/wordpress/components/Analysis/HealthFindingsPanel.tsx', 'wordpress.findings.'],
  ['components/site-cockpit/cards/wordpress/components/Analysis/VersionStatus.tsx', 'wordpress.version.'],
  ['components/site-cockpit/cards/wordpress/components/Analysis/PluginsPanel.tsx', 'wordpress.plugins.'],
  ['components/site-cockpit/cards/wordpress/components/ConnectionStatus/ConnectionBanner.tsx', 'wordpress.connection.'],
  ['components/site-cockpit/cards/wordpress/components/Analysis/AppliedChangesPanel.tsx', 'wordpress.changes.'],
  ['components/site-cockpit/cards/ConnectionCard.tsx', 'connection.'],
  ['components/site-cockpit/cards/wordpress/components/ConnectionStatus/ReconnectionModal.tsx', 'wordpress.connection.modal.'],
  ['components/site-cockpit/cards/wordpress/components/Analysis/CoreFilesReview.tsx', 'wordpress.coreReview.'],
  ['components/site-cockpit/cards/wordpress/components/Analysis/CspPanel.tsx', 'wordpress.csp.'],
];

test('every literal translation key used by the cockpit exists in all six languages', () => {
  for (const [file, namespace] of COMPONENTS) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const keys = [...source.matchAll(/\bt(?:\.rich)?\(\s*"([\w.]+)"/g)].map((m) => namespace + m[1]);
    assert.ok(keys.length > 0, `${file}: no keys found`);
    for (const key of keys) {
      for (const locale of LOCALES) {
        assert.equal(typeof lookup(catalogs[locale], key), 'string', `${locale}: ${key} (${file})`);
      }
    }
  }
});

test('keys built from known lists exist, and every message parses', () => {
  const dynamic = [
    ...FOCUS_CATEGORIES.map((c) => `focus.labels.${c}`),
    ...['high', 'medium', 'low'].map((s) => `nextStep.severity.${s}`),
    ...['loginPage', 'userEnum', 'xmlrpc', 'debugMode', 'protected', 'exposed', 'blocked', 'vulnerable', 'enabled', 'disabled', 'on', 'off'].map(
      (k) => `wordpress.security.${k}`,
    ),
    ...['security', 'performance', 'stability', 'seoUx', 'redFlags'].map((k) => `wordpress.findings.categories.${k}`),
    ...['active', 'unverified', 'undone'].map((k) => `wordpress.changes.state.${k}`),
    ...['undo', 'undoNewerFirst'].map((k) => `wordpress.changes.errors.${k}`),
    ...PAIRING_MESSAGE_KEYS.map((k) => `connection.pairing.messages.${k}`),
    ...VERDICTS.map((k) => `wordpress.coreReview.verdict.${k}`),
    ...SIGNALS.map((k) => `wordpress.coreReview.signal.${k}`),
    ...RECOMMENDATIONS.map((k) => `wordpress.coreReview.recommendation.${k}`),
    ...['modified', 'unexpected'].map((k) => `wordpress.coreReview.kind.${k}`),
    ...['GENERIC', 'RATE_LIMITED', 'WORDPRESS_NOT_CONNECTED', 'CORE_FILES_UNAVAILABLE'].map((k) => `wordpress.coreReview.errors.${k}`),
    ...['GENERIC', 'RATE_LIMITED', 'SITE_UNREACHABLE', 'CONNECTOR_UPDATE', 'CONNECTOR_UNREACHABLE', 'CONNECTOR_FAILED', 'WORDPRESS_NOT_CONNECTED', 'TEST_RUNNING'].map(
      (k) => `wordpress.csp.errors.${k}`,
    ),
    ...['custom', 'unknown'].map((k) => `connection.platforms.${k}`),
    ...['external', 'perfSeo', 'a11y', 'headers', 'structured'].map((k) => `connection.info.without.${k}`),
    ...['workflows', 'fixes', 'diagnostics', 'monitoring', 'audit'].map((k) => `connection.info.with.${k}`),
  ];
  for (const locale of LOCALES) {
    for (const key of dynamic) assert.equal(typeof lookup(catalogs[locale], key), 'string', `${locale}: ${key}`);
    for (const section of ['focus', 'nextStep', 'wordpress', 'connection']) {
      const walk = (node: any, prefix: string) => {
        for (const [k, v] of Object.entries(node)) {
          // Parsing with tags enabled (as next-intl does) catches broken ICU syntax.
          if (typeof v === 'string') new IntlMessageFormat(v, locale).getAst();
          else walk(v, `${prefix}.${k}`);
        }
      };
      walk(catalogs[locale][section], section);
    }
  }
});

test('rich-text messages keep their tags in every language', () => {
  const tagged: Array<[key: string, tag: string]> = [
    ['connection.method.snippet.description', '<code>head</code>'],
    ['connection.snippet.step2', '<code>head</code>'],
    ['wordpress.connection.modal.guideSteps.step1', '<link>'],
  ];
  for (const locale of LOCALES) {
    for (const [key, tag] of tagged) {
      const message = lookup(catalogs[locale], key);
      assert.ok(typeof message === 'string' && message.includes(tag), `${locale}: ${key} lacks ${tag}`);
    }
  }
});
