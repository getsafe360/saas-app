import { NextResponse } from 'next/server';

// Bump PLUGIN_VERSION and set WP_PLUGIN_DOWNLOAD_URL env var with each release.
// WP_PLUGIN_DOWNLOAD_URL should point to the publicly accessible plugin ZIP
// (e.g. a Vercel Blob URL: https://xxxx.blob.vercel-storage.com/getsafe360-connector-v0.3.0.zip)
const PLUGIN_VERSION = '0.3.0';

export async function GET() {
    const downloadUrl = process.env.WP_PLUGIN_DOWNLOAD_URL ?? '';

    return NextResponse.json(
        {
            version: PLUGIN_VERSION,
            download_url: downloadUrl,
            tested: '6.7',
            requires: '5.0',
            requires_php: '7.2',
            description:
                'Secure connector between your WordPress site and GetSafe 360 AI for automated security scanning, performance monitoring, and AI-powered repairs.',
            changelog:
                '<h4>0.3.0</h4><ul><li>Automatic updates via WordPress update system</li><li>Full i18n: German, Spanish, French, Italian, Portuguese</li></ul>' +
                '<h4>0.2.1</h4><ul><li>SEO injection via wp_head</li><li>REST API routes: ping, status, push, pull</li></ul>' +
                '<h4>0.2.0</h4><ul><li>Initial release</li></ul>',
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        }
    );
}
