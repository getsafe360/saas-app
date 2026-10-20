// saas-ux/next.config.js
// @ts-check

const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
// Baseline security headers for every response. A Content-Security-Policy is
// deliberately not set here yet: it has to allow Clerk, Stripe, Vercel and the
// analytics scripts, and a wrong one breaks sign-in or checkout. Add it as a
// Report-Only policy first.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = withNextIntl({
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  experimental: {
    // enable Partial Prerendering ppr: 'incremental',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' } // Vercel Blob screenshots
    ]
  }
});

module.exports = nextConfig;