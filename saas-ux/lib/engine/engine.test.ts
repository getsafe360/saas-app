import assert from 'node:assert/strict';
import test from 'node:test';

import type { Finding } from './contracts';
import { evaluateRules, isSelectedByDefault, type Rule } from './rules';
import { computeTrend, scoreCategory, scoreFindings } from './scoring';
import { buildWordPressFacts } from './wordpress/facts';
import { evaluateWordPressHealth } from './wordpress/view';

function finding(partial: Partial<Finding>): Finding {
  return {
    id: 'x',
    category: 'security',
    title: 'X',
    status: 'pass',
    severity: 'medium',
    confidence: 'high',
    summary: '',
    recommendation: '',
    selectedByDefault: false,
    ...partial,
  };
}

const autoFix = { fixerId: 'f', automation: 'auto' as const, risk: 'low' as const, reversible: true };

test('only failing/warning critical/high fixable findings are preselected', () => {
  assert.equal(isSelectedByDefault({ status: 'fail', severity: 'high', fix: autoFix }), true);
  assert.equal(isSelectedByDefault({ status: 'warn', severity: 'critical', fix: autoFix }), true);
  // Passing high-severity checks used to be prechecked; they must not be.
  assert.equal(isSelectedByDefault({ status: 'pass', severity: 'high', fix: autoFix }), false);
  assert.equal(isSelectedByDefault({ status: 'unknown', severity: 'critical', fix: autoFix }), false);
  assert.equal(isSelectedByDefault({ status: 'fail', severity: 'medium', fix: autoFix }), false);
  assert.equal(isSelectedByDefault({ status: 'fail', severity: 'high', fix: undefined }), false);
  assert.equal(
    isSelectedByDefault({ status: 'fail', severity: 'high', fix: { ...autoFix, automation: 'manual' } }),
    false,
  );
});

test('a throwing rule becomes unknown instead of breaking the report', () => {
  const rules: Rule<null>[] = [
    {
      id: 'boom',
      category: 'security',
      severity: 'high',
      source: 'connector',
      evaluate: () => {
        throw new Error('bad input');
      },
    },
  ];
  const [result] = evaluateRules(rules, null);
  assert.equal(result.status, 'unknown');
  assert.equal(result.evidence, undefined);
});

test('unknown checks are excluded from category scores', () => {
  const onlyUnknown = scoreCategory('security', [finding({ status: 'unknown', severity: 'critical' })]);
  assert.equal(onlyUnknown.score, null);
  assert.equal(onlyUnknown.coverage, 0);

  const mixed = scoreCategory('security', [
    finding({ status: 'fail', severity: 'high' }),
    finding({ status: 'warn', severity: 'medium' }),
    finding({ status: 'unknown', severity: 'critical' }),
  ]);
  assert.equal(mixed.score, 100 - 20 - 5);
  assert.equal(mixed.coverage, 2 / 3);
});

test('overall score renormalises weights across categories that have a score', () => {
  const score = scoreFindings(
    [
      finding({ category: 'security', status: 'fail', severity: 'high' }), // 80
      finding({ category: 'performance', status: 'pass' }), // 100
      finding({ category: 'stability', status: 'unknown' }), // null
    ],
    { security: 0.5, performance: 0.25, stability: 0.25 },
  );
  assert.equal(score.overall, Math.round((80 * 0.5 + 100 * 0.25) / 0.75));
  assert.equal(score.categories.stability?.score, null);

  assert.equal(scoreFindings([finding({ status: 'unknown' })], { security: 1 }).overall, null);
});

test('trend exists only with a real previous score', () => {
  assert.equal(computeTrend(undefined, 70), undefined);
  assert.equal(computeTrend(60, null), undefined);
  assert.deepEqual(computeTrend(60, 72), { previous: 60, current: 72, delta: 12 });
});

test('WordPress facts never default unobserved values', () => {
  const facts = buildWordPressFacts({ cms: { type: 'wordpress', wp: { version: '6.6.1', xmlrpc: null } } });
  assert.equal(facts.protections.userEnumerationBlocked, null);
  assert.equal(facts.protections.xmlrpcDisabled, null);
  assert.equal(facts.plugins.vulnerable, null);
  assert.equal(facts.plugins.outdated, null);
  assert.equal(facts.performance.objectCache, null);
  assert.equal(facts.performance.compression, null);
  assert.equal(facts.core.version, '6.6.1');
});

test('WordPress health with no telemetry has no score and no preselection', () => {
  const report = evaluateWordPressHealth(buildWordPressFacts({ cms: { type: 'wordpress', wp: {} } }));
  assert.equal(report.score.overall, null);
  assert.ok(report.findings.every((f) => f.status === 'unknown'));
  assert.ok(report.view.findings.every((f) => !f.checkedByDefault));
  assert.equal(report.view.categoryScores.security, null);
});

test('connector protections and observed headers drive WordPress findings', () => {
  const report = evaluateWordPressHealth(
    buildWordPressFacts({
      connectionStatus: { isConnected: true },
      headers: { 'Content-Encoding': 'br' },
      cms: { type: 'wordpress', wp: { version: '6.5.0' } },
      wordpressTelemetry: {
        latestVersion: '6.6.2',
        snapshot: {
          inspectedAt: '2026-11-04T00:00:00.000Z',
          wpVersion: '6.5.0',
          activePlugins: ['a/a.php', 'b/b.php'],
          protections: { disableXmlRpc: true, blockUserEnumeration: false },
        },
      },
    }),
  );
  const byId = new Map(report.findings.map((f) => [f.id, f]));

  assert.equal(byId.get('wp-core-version')?.status, 'fail');
  assert.equal(byId.get('wp-xmlrpc')?.status, 'pass');
  assert.equal(byId.get('wp-gzip')?.status, 'pass');
  assert.equal(byId.get('wp-gzip')?.evidence?.observed, 'br');

  const enumeration = byId.get('wp-user-enumeration');
  assert.equal(enumeration?.status, 'warn');
  assert.equal(enumeration?.selectedByDefault, true);

  // The core-modification red flag is no longer inferred from an outdated core.
  assert.equal(byId.get('red-flag-core-modifications')?.status, 'unknown');

  const view = report.view.findings.find((f) => f.id === 'wp-user-enumeration');
  assert.equal(view?.status, 'warning');
  assert.equal(view?.checkedByDefault, true);
  assert.equal(view?.remediationActionId, 'wordpress-block-user-enumeration');
  assert.equal(typeof report.score.overall, 'number');
});
