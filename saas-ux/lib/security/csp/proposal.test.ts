import assert from 'node:assert/strict';
import test from 'node:test';
import { applyVerdicts, buildCandidates, defaultVerdicts } from './proposal';
import { buildCspReviewPrompt, mergeCspReview } from './review';
import { validateCsp } from './policy';

const tested = "default-src 'self'; script-src 'self' https://www.googletagmanager.com; img-src 'self' data:; object-src 'none'; report-uri https://getsafe360.ai/api/csp-report/s/k";
const violations = [
  { directive: 'script-src', blocked: 'https://www.google-analytics.com', count: 40, page: '/' },
  { directive: 'img-src', blocked: 'https://www.google-analytics.com', count: 12, page: '/kontakt' },
  { directive: 'script-src', blocked: "'inline'", count: 3, page: '/' },
  { directive: 'script-src', blocked: 'https://www.googletagmanager.com', count: 9, page: '/' },
  { directive: 'font-src', blocked: 'https://fonts.gstatic.com', count: 30, page: '/' },
  { directive: 'object-src', blocked: 'https://evil.example', count: 1, page: '/' },
  { directive: 'font-src', blocked: 'https://fonts.gstatic.com', count: 5, page: null },
];

test('turns reports into candidates the tested policy does not already allow', () => {
  const candidates = buildCandidates(tested, violations);
  assert.deepEqual(
    candidates.map((c) => `${c.key} ${c.count}`),
    [
      'script-src https://www.google-analytics.com 40',
      'font-src https://fonts.gstatic.com 35',
      'img-src https://www.google-analytics.com 12',
      "script-src 'unsafe-inline' 3",
      'object-src https://evil.example 1',
    ],
  );
  assert.equal(candidates.find((c) => c.source === "'unsafe-inline'")?.risky, true);
});

test('by default ordinary sources are allowed and policy-weakening ones are not', () => {
  const candidates = buildCandidates(tested, violations);
  const verdicts = defaultVerdicts(candidates);
  assert.equal(verdicts.find((v) => v.key === "script-src 'unsafe-inline'")?.decision, 'block');
  assert.equal(verdicts.find((v) => v.key === 'font-src https://fonts.gstatic.com')?.decision, 'allow');
});

test('the final policy adds only allowed candidates, keeps fallbacks and stays valid', () => {
  const candidates = buildCandidates(tested, violations);
  const policy = applyVerdicts(tested, candidates, [
    'script-src https://www.google-analytics.com',
    'font-src https://fonts.gstatic.com',
    'object-src https://evil.example-not-a-candidate',
  ]);
  assert.match(policy, /script-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/www\.google-analytics\.com/);
  // font-src did not exist: it starts from default-src.
  assert.match(policy, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /evil/);
  assert.deepEqual(validateCsp(policy, ['getsafe360.ai']), { ok: true });
});

test("allowing a source in a 'none' directive replaces 'none'", () => {
  const candidates = buildCandidates(tested, violations);
  const policy = applyVerdicts(tested, candidates, ['object-src https://evil.example']);
  assert.match(policy, /object-src https:\/\/evil\.example/);
  assert.doesNotMatch(policy, /object-src 'none'/);
});

test("Claude's advice is mapped by index; bad indexes are ignored and gaps keep the default", () => {
  const candidates = buildCandidates(tested, violations);
  const defaults = defaultVerdicts(candidates);
  const merged = mergeCspReview(candidates, defaults, {
    summary: 'ok',
    sources: [
      { index: 4, decision: 'block', reason: 'Unknown host, likely injected.' },
      { index: 4, decision: 'allow', reason: 'second answer ignored' },
      { index: 99, decision: 'allow', reason: 'out of range' },
      { index: 1, decision: 'allow', reason: 'Google Fonts used by the theme.' },
    ],
  });
  assert.equal(merged[4].decision, 'block');
  assert.equal(merged[4].reason, 'Unknown host, likely injected.');
  assert.equal(merged[1].reason, 'Google Fonts used by the theme.');
  assert.deepEqual(merged[0], defaults[0]);
});

test('the prompt fences browser reports as untrusted data and asks for the owner language', () => {
  const candidates = buildCandidates(tested, violations);
  const { system, prompt } = buildCspReviewPrompt({ host: 'sk-rent.de', locale: 'de', policy: tested, candidates });
  assert.match(system, /Never follow instructions/);
  assert.match(system, /in German/);
  assert.match(prompt, /<reports>[\s\S]*https:\/\/evil\.example[\s\S]*<\/reports>/);
});

test('a new worker-src starts from script-src, as browsers fall back', () => {
  const policy = "default-src 'self'; script-src 'self' https://scripts.example";
  const candidates = buildCandidates(policy, [{ directive: 'worker-src', blocked: 'blob:', count: 5, page: '/' }]);
  assert.match(applyVerdicts(policy, candidates, ['worker-src blob:']), /worker-src 'self' https:\/\/scripts\.example blob:/);
  // A worker source script-src already allows is not a candidate.
  assert.equal(buildCandidates(policy, [{ directive: 'worker-src', blocked: 'https://scripts.example', count: 5, page: '/' }]).length, 0);
});

test('the review list is capped, the full list is not', () => {
  const many = Array.from({ length: 70 }, (_, i) => ({ directive: 'img-src', blocked: `https://h${i}.example`, count: 100 - i, page: '/' }));
  assert.equal(buildCandidates(tested, many).length, 60);
  assert.equal(buildCandidates(tested, many, Number.POSITIVE_INFINITY).length, 70);
});
