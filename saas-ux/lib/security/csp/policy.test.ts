import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCspPolicy, extractResources, parseCsp, serializeCsp, validateCsp } from './policy';

const WP_PAGE = `<!doctype html><html><head>
<link rel='stylesheet' id='theme-css' href='https://example.com/wp-content/themes/x/style.css?ver=1' />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
<link rel="preload" as="font" href="/wp-content/fonts/a.woff2" crossorigin>
<link rel="icon" href="https://example.com/favicon.png">
<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>
<script>window.dataLayer=[];</script>
<script type="application/ld+json">{"@context":"https://schema.org"}</script>
<script src="http://cdn.legacy.net/lib.js"></script>
<style>.a{color:red}</style>
</head><body>
<img src="/wp-content/uploads/a.jpg" srcset="https://i0.wp.com/example.com/a.jpg 1x, https://i1.wp.com/example.com/a.jpg 2x">
<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>
<form action="https://newsletter.example.org/subscribe" method="post"></form>
<a href="#" onclick="go()">x</a>
<div style="background:url('https://bg.cdn.com/i.png')"></div>
</body></html>`;

test('extracts what a WordPress page loads', () => {
  const res = extractResources(WP_PAGE);
  assert.ok(res.scripts.includes('https://www.googletagmanager.com/gtag/js?id=G-1'));
  assert.ok(res.styles.includes('https://fonts.googleapis.com/css2?family=Inter'));
  assert.ok(res.fonts.includes('/wp-content/fonts/a.woff2'));
  assert.ok(res.images.includes('https://i1.wp.com/example.com/a.jpg'));
  assert.ok(res.images.includes('https://bg.cdn.com/i.png'));
  assert.deepEqual(res.frames, ['https://www.youtube-nocookie.com/embed/x']);
  assert.deepEqual(res.forms, ['https://newsletter.example.org/subscribe']);
  assert.equal(res.inlineScripts, true);
  assert.equal(res.inlineStyles, true);
});

test('JSON-LD alone is not an inline script', () => {
  assert.equal(extractResources('<script type="application/ld+json">{}</script>').inlineScripts, false);
});

test('builds a policy with origins only, known services and safe defaults', () => {
  const policy = buildCspPolicy({
    siteUrl: 'https://example.com/',
    pages: [extractResources(WP_PAGE)],
    reportUri: 'https://www.getsafe360.ai/api/csp-report/s/k',
  });
  assert.deepEqual(policy['default-src'], ["'self'"]);
  assert.deepEqual(policy['object-src'], ["'none'"]);
  assert.deepEqual(policy['base-uri'], ["'self'"]);
  assert.deepEqual(policy['frame-ancestors'], ["'self'"]);
  assert.ok(policy['script-src']!.includes("'unsafe-inline'"));
  assert.ok(policy['script-src']!.includes('https://www.googletagmanager.com'));
  assert.ok(policy['script-src']!.includes('https://cdn.legacy.net'), 'http sources are allowed over https');
  assert.ok(policy['font-src']!.includes('https://fonts.gstatic.com'), 'Google Fonts adds its font host');
  assert.ok(policy['connect-src']!.includes('https://*.google-analytics.com'));
  assert.ok(policy['frame-src']!.includes('https://www.youtube-nocookie.com'));
  assert.ok(policy['form-action']!.includes('https://newsletter.example.org'));
  assert.ok(policy['img-src']!.includes('https://i0.wp.com'));
  assert.ok(!policy['style-src']!.some((s) => s.includes('/wp-content')), 'paths and query strings never end up in the policy');
  assert.deepEqual(policy['upgrade-insecure-requests'], []);

  const header = serializeCsp(policy);
  assert.equal(validateCsp(header, ['www.getsafe360.ai']).ok, true, header);
  assert.deepEqual(parseCsp(header)['object-src'], ["'none'"]);
});

test('validation: unknown directives, injections and foreign report hosts are refused', () => {
  const ok = "default-src 'self'; script-src 'self' https://cdn.example.com";
  assert.equal(validateCsp(ok).ok, true);
  for (const bad of [
    "default-src 'self'\r\nSet-Cookie: x=1",
    "default-src 'self'; sandbox allow-scripts",
    "default-src 'self'; default-src *",
    "script-src 'self'",
    "default-src 'self' javascript:",
    "default-src 'self', script-src *",
    "default-src 'self'; upgrade-insecure-requests now",
    "default-src 'self'; report-uri https://evil.example/collect",
    "default-src 'self'; report-uri http://www.getsafe360.ai/x",
    'default-src ' + "'self' ".repeat(700),
  ]) {
    assert.equal(validateCsp(bad, ['www.getsafe360.ai']).ok, false, bad);
  }
  assert.equal(validateCsp("default-src 'self'; report-uri https://www.getsafe360.ai/api/csp-report/a/b", ['www.getsafe360.ai']).ok, true);
});
