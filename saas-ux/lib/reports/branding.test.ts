import assert from 'node:assert/strict';
import test from 'node:test';
import { isOwnLogoUrl, parseBrandingInput, sniffImageType } from './branding';

const logo = 'https://abc123.public.blob.vercel-storage.com/branding/7/logo-x1y2.png';

test('accepts a complete branding form and normalises it', () => {
  const result = parseBrandingInput({
    companyName: '  Webagentur Berlin ',
    logoUrl: logo,
    primaryColor: '#0F766E',
    website: 'webagentur.berlin',
    email: 'hallo@webagentur.berlin',
    footerText: '',
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      companyName: 'Webagentur Berlin',
      logoUrl: logo,
      primaryColor: '#0f766e',
      website: 'https://webagentur.berlin',
      email: 'hallo@webagentur.berlin',
      footerText: null,
    },
  });
});

test('rejects what a report must not carry', () => {
  const base = { companyName: 'A' };
  assert.deepEqual(parseBrandingInput({}), { ok: false, error: 'COMPANY_REQUIRED' });
  assert.deepEqual(parseBrandingInput({ ...base, logoUrl: 'https://evil.example/logo.png' }), { ok: false, error: 'INVALID_LOGO' });
  assert.deepEqual(parseBrandingInput({ ...base, logoUrl: 'http://169.254.169.254/' }), { ok: false, error: 'INVALID_LOGO' });
  assert.deepEqual(parseBrandingInput({ ...base, primaryColor: 'red;}' }), { ok: false, error: 'INVALID_COLOR' });
  assert.deepEqual(parseBrandingInput({ ...base, website: 'javascript:alert(1)' }), { ok: false, error: 'INVALID_WEBSITE' });
  assert.deepEqual(parseBrandingInput({ ...base, email: 'no-at-sign' }), { ok: false, error: 'INVALID_EMAIL' });
  assert.deepEqual(parseBrandingInput({ ...base, footerText: 'x'.repeat(301) }), { ok: false, error: 'TOO_LONG' });
});

test('only our own blob uploads count as logos', () => {
  assert.equal(isOwnLogoUrl(logo), true);
  assert.equal(isOwnLogoUrl('https://abc123.public.blob.vercel-storage.com/reports/x.png'), false);
  assert.equal(isOwnLogoUrl('https://public.blob.vercel-storage.com.evil.io/branding/x.png'), false);
});

test('recognises image types by their bytes', () => {
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png');
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), null);
});
