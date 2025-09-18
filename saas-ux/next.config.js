// saas-ux/next.config.js
// @ts-check
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: 'incremental', // enable PPR feature on the project
     // Add your allowed dev origin(s) here allowedDevOrigins: ['http://192.168.178.100'],
  },
};

module.exports = withNextIntl(nextConfig);
