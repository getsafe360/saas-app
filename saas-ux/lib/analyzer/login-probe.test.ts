import assert from 'node:assert/strict';
import test from 'node:test';
import { loginPageExposed } from './preScan';
import { buildWordPressFacts } from '@/lib/engine/wordpress/facts';

function mockFetch(status: number, body = ''): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(body, { status, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const allow = () => true;

test('the default login form counts as exposed', async () => {
  const restore = mockFetch(200, '<form name="loginform" id="loginform" action="/wp-login.php"><input name="log"></form>');
  try {
    assert.equal(await loginPageExposed('https://example.com', allow), true);
  } finally {
    restore();
  }
});

test('a moved login page (WPS Hide Login answers 404 or a normal page) is not exposed', async () => {
  for (const [status, body] of [[404, 'Not found'], [200, '<h1>Willkommen</h1>'], [403, '']] as const) {
    const restore = mockFetch(status, body);
    try {
      assert.equal(await loginPageExposed('https://example.com', allow), false, `${status}`);
    } finally {
      restore();
    }
  }
});

test('server errors stay unknown', async () => {
  const restore = mockFetch(503, '');
  try {
    assert.equal(await loginPageExposed('https://example.com', allow), null);
  } finally {
    restore();
  }
});

test('the public probe decides whether the login page is protected', () => {
  const facts = (loginExposed: boolean | null) =>
    buildWordPressFacts({ cms: { type: 'wordpress', wp: { version: '6.8' } }, publicCms: { type: 'wordpress', wp: { loginExposed } } });
  assert.equal(facts(false).security.loginProtected, true);
  assert.equal(facts(true).security.loginProtected, false);
  assert.equal(facts(null).security.loginProtected, null);
});
