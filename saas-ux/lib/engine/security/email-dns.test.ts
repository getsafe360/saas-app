import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRules } from '../rules';
import { EMAIL_DNS_RULES, buildEmailDnsFacts, mailDomainFor, probeEmailDns } from './email-dns';

const dnsError = (code: string) => Object.assign(new Error(code), { code });

function resolver(records: Record<string, string[][] | Error>) {
  return async (name: string) => {
    const value = records[name];
    if (value instanceof Error) throw value;
    if (!value) throw dnsError('ENOTFOUND');
    return value;
  };
}

function evaluate(probe: unknown) {
  return new Map(evaluateRules(EMAIL_DNS_RULES, buildEmailDnsFacts({ emailDns: probe })).map((f) => [f.id, f]));
}

test('mail domain is the site host without www', () => {
  assert.equal(mailDomainFor('https://www.sk-rent.de/path'), 'sk-rent.de');
  assert.equal(mailDomainFor('https://shop.example.co.uk'), 'shop.example.co.uk');
  assert.equal(mailDomainFor('http://192.168.1.10'), null);
  assert.equal(mailDomainFor('not a url'), null);
});

test('probe joins split TXT chunks and keeps only SPF / DMARC records', async () => {
  const probe = await probeEmailDns('https://www.example.com', {
    resolveTxt: resolver({
      'example.com': [['v=spf1 include:_spf.example.net ', '-all'], ['google-site-verification=abc']],
      '_dmarc.example.com': [['v=DMARC1; p=reject; rua=mailto:d@example.com']],
    }),
  });
  assert.deepEqual(probe?.spf, ['v=spf1 include:_spf.example.net -all']);
  assert.deepEqual(probe?.dmarc, ['v=DMARC1; p=reject; rua=mailto:d@example.com']);

  const byId = evaluate(probe);
  assert.equal(byId.get('email-spf')?.status, 'pass');
  assert.equal(byId.get('email-dmarc')?.status, 'pass');
});

test('missing records fail; lookup errors and timeouts stay unknown', async () => {
  const missing = await probeEmailDns('https://example.org', {
    resolveTxt: resolver({ 'example.org': dnsError('ENODATA') }),
  });
  assert.deepEqual(missing?.spf, []);
  assert.deepEqual(missing?.dmarc, [], 'NXDOMAIN for _dmarc counts once the domain itself answered');
  assert.equal(evaluate(missing).get('email-spf')?.status, 'fail');
  assert.equal(evaluate(missing).get('email-dmarc')?.status, 'fail');

  const broken = await probeEmailDns('https://example.org', {
    resolveTxt: resolver({ 'example.org': dnsError('ESERVFAIL'), '_dmarc.example.org': dnsError('ETIMEOUT') }),
  });
  assert.equal(broken?.spf, null);
  assert.equal(evaluate(broken).get('email-spf')?.status, 'unknown');
  assert.equal(evaluate(broken).get('email-dmarc')?.status, 'unknown');

  const slow = await probeEmailDns('https://example.org', {
    timeoutMs: 20,
    resolveTxt: () => new Promise((done) => setTimeout(() => done([['v=spf1 -all']]), 200)),
  });
  assert.equal(slow?.spf, null, 'a slow resolver is unknown, not "no record"');

  assert.equal(evaluate(null).get('email-spf')?.status, 'unknown', 'no probe at all');

  // A resolver that answers "not found" for every name (e.g. no DNS at all).
  const blind = await probeEmailDns('https://getsafe360.ai', { resolveTxt: resolver({}) });
  assert.equal(blind?.spf, null);
  assert.equal(blind?.dmarc, null);
  assert.equal(evaluate(blind).get('email-spf')?.status, 'unknown');
  assert.equal(evaluate(blind).get('email-dmarc')?.status, 'unknown');
});

test('weak SPF and monitoring-only DMARC warn; duplicate SPF fails', () => {
  const weak = evaluate({ domain: 'a.com', spf: ['v=spf1 include:x.com ?all'], dmarc: ['v=DMARC1; p=none'] });
  assert.equal(weak.get('email-spf')?.status, 'warn');
  assert.equal(weak.get('email-dmarc')?.status, 'warn');

  const noAll = evaluate({ domain: 'a.com', spf: ['v=spf1 include:x.com'], dmarc: ['v=DMARC1; p=quarantine'] });
  assert.equal(noAll.get('email-spf')?.status, 'warn');
  assert.equal(noAll.get('email-dmarc')?.status, 'pass');

  const redirect = evaluate({ domain: 'a.com', spf: ['v=spf1 redirect=_spf.a.com'], dmarc: [] });
  assert.equal(redirect.get('email-spf')?.status, 'pass');

  const duplicate = evaluate({ domain: 'a.com', spf: ['v=spf1 -all', 'v=spf1 include:x.com -all'], dmarc: [] });
  assert.equal(duplicate.get('email-spf')?.status, 'fail');
});
