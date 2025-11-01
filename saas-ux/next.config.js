// saas-ux/next.config.js
// @ts-check

const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = withNextIntl({
  experimental: {
    ppr: 'incremental', // enable Partial Prerendering
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' } // Vercel Blob screenshots
    ]
  }
});

module.exports = nextConfig;