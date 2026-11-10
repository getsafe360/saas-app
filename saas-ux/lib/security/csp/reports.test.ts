import assert from 'node:assert/strict';
import test from 'node:test';

process.env.CSP_REPORT_SECRET = 'test-secret';

import { pickInternalLinks } from './links';
import { isValidReportKey, normalizeReports, readViolations, reportKey, reportUriFor, storeViolations } from './reports';

test('report keys are per site and checked in constant time', () => {
  const key = reportKey('site-a');
  assert.match(key, /^[a-f0-9]{32}$/);
  assert.notEqual(key, reportKey('site-b'));
  assert.equal(isValidReportKey('site-a', key), true);
  assert.equal(isValidReportKey('site-b', key), false);
  assert.equal(isValidReportKey('site-a', 'x'.repeat(32)), false);
  assert.match(reportUriFor('site-a'), /\/api\/csp-report\/site-a\/[a-f0-9]{32}$/);
});

test('normalizes both report formats to directive + origin + page path', () => {
  const legacy = normalizeReports({
    'csp-report': {
      'document-uri': 'https://example.com/shop/item?id=5&email=a@b.c',
      'violated-directive': 'script-src-elem',
      'blocked-uri': 'https://cdn.tracker.io/x.js?u=secret',
    },
  });
  assert.deepEqual(legacy, [{ directive: 'script-src', blocked: 'https://cdn.tracker.io', page: '/shop/item' }]);

  const modern = normalizeReports([
    { type: 'csp-violation', body: { documentURL: 'https://example.com/', effectiveDirective: 'script-src-attr', blockedURL: 'inline' } },
    { type: 'csp-violation', body: { documentURL: 'https://example.com/', effectiveDirective: 'script-src', blockedURL: 'eval' } },
    { type: 'csp-violation', body: { documentURL: 'https://example.com/', effectiveDirective: 'img-src', blockedURL: 'chrome-extension://abc/x.png' } },
    { type: 'csp-violation', body: { documentURL: 'https://example.com/', effectiveDirective: 'img-src', blockedURL: 'data' } },
    { type: 'deprecation', body: {} },
  ]);
  assert.deepEqual(
    modern.map((v) => `${v.directive} ${v.blocked}`),
    ["script-src 'inline'", "script-src 'eval'", 'img-src data:'],
    'extension noise and other report types are ignored',
  );
  assert.deepEqual(normalizeReports({ 'csp-report': { 'violated-directive': 'x; y', 'blocked-uri': 'inline' } }), []);
  assert.deepEqual(normalizeReports('nope'), []);
});

test('violations are counted per directive and source (in-memory without Redis)', async () => {
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  const v = { directive: 'script-src', blocked: 'https://cdn.tracker.io', page: '/a' };
  await storeViolations('mem-site', [v, v, { ...v, page: '/b' }, { directive: 'img-src', blocked: 'data:', page: '/c' }]);
  const summary = await readViolations('mem-site');
  assert.deepEqual(summary[0], { directive: 'script-src', blocked: 'https://cdn.tracker.io', count: 3, page: '/a' });
  assert.equal(summary.length, 2);
});

test('inner pages: same host, real pages, one per section', () => {
  const html = `
    <a href="/blog/post-1/">1</a><a href="/blog/post-2/">2</a><a href="https://example.com/shop/">s</a>
    <a href="/wp-admin/">a</a><a href="/wp-login.php">l</a><a href="/feed/">f</a><a href="/?p=3">q</a>
    <a href="/files/a.pdf">pdf</a><a href="https://other.com/x">o</a><a href="mailto:a@b.c">m</a><a href="/contact">c</a>`;
  assert.deepEqual(pickInternalLinks(html, 'https://example.com/'), [
    'https://example.com/blog/post-1/',
    'https://example.com/shop/',
    'https://example.com/contact',
  ]);
});

test('a full Redis list keeps counting known sources and admits no new ones', async () => {
  const hashes = new Map<string, Map<string, string>>();
  const hash = (key: string) => {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key)!;
  };
  const fake = {
    hlen: async (key: string) => hash(key).size,
    pipeline: () => {
      const ops: Array<() => unknown> = [];
      const p = {
        hexists: (key: string, field: string) => (ops.push(() => (hash(key).has(field) ? 1 : 0)), p),
        hincrby: (key: string, field: string, by: number) =>
          (ops.push(() => hash(key).set(field, String(Number(hash(key).get(field) ?? 0) + by))), p),
        hsetnx: (key: string, field: string, value: string) =>
          (ops.push(() => (hash(key).has(field) ? 0 : (hash(key).set(field, value), 1))), p),
        expire: () => (ops.push(() => 1), p),
        exec: async () => ops.map((op) => op()),
      };
      return p;
    },
  };
  const site = 'site-cap';
  const full = Array.from({ length: 300 }, (_, i) => ({ directive: 'img-src', blocked: `https://h${i}.example`, page: '/' }));
  await storeViolations(site, full, fake as never);
  assert.equal(hash(`csp:${site}:counts`).size, 300);

  await storeViolations(
    site,
    [
      { directive: 'img-src', blocked: 'https://h1.example', page: '/' },
      { directive: 'img-src', blocked: 'https://h1.example', page: '/' },
      { directive: 'img-src', blocked: 'https://new.example', page: '/' },
    ],
    fake as never,
  );
  const counts = hash(`csp:${site}:counts`);
  assert.equal(counts.get('img-src https://h1.example'), '3');
  assert.equal(counts.has('img-src https://new.example'), false);
  assert.equal(counts.size, 300);

  // Room for one more: only the first new source is admitted.
  counts.delete('img-src https://h0.example');
  await storeViolations(
    site,
    [
      { directive: 'img-src', blocked: 'https://a.example', page: '/' },
      { directive: 'img-src', blocked: 'https://b.example', page: '/' },
    ],
    fake as never,
  );
  assert.equal(counts.size, 300);
  assert.equal(counts.has('img-src https://a.example'), true);
  assert.equal(counts.has('img-src https://b.example'), false);
});
