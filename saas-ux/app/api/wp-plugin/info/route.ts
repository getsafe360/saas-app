import { NextResponse } from 'next/server';

// Bump PLUGIN_VERSION and set WP_PLUGIN_DOWNLOAD_URL env var with each release.
// WP_PLUGIN_DOWNLOAD_URL should point to the publicly accessible plugin ZIP
// (e.g. a Vercel Blob URL: https://xxxx.blob.vercel-storage.com/getsafe360-connector-v0.3.0.zip)
const PLUGIN_VERSION = '1.4.0';

export async function GET() {
    const downloadUrl = process.env.WP_PLUGIN_DOWNLOAD_URL ?? '';

    // Don't advertise an update if the ZIP URL hasn't been configured — WordPress
    // would try to install an empty package URL and fail on every connected site.
    if (!downloadUrl) {
        return NextResponse.json(
            { error: 'Plugin download URL not configured.' },
            { status: 503 }
        );
    }

    return NextResponse.json(
        {
            version: PLUGIN_VERSION,
            download_url: downloadUrl,
            tested: '6.7',
            requires: '5.0',
            requires_php: '7.2',
            icons: {
                svg: 'https://www.getsafe360.ai/icons/360.svg',
                '1x': 'https://www.getsafe360.ai/icons/360.svg',
            },
            description:
                'Secure connector between your WordPress site and <strong>GetSafe 360 AI</strong> for automated security scanning, performance monitoring, and AI-powered repairs. <a href="https://www.getsafe360.ai/docs/wordpress-connector">View documentation</a>',
            changelog:
                '<h4>1.4.0</h4><ul><li>Add connector action gateway for allowlisted WordPress security mutations</li><li>Support auto-applied XML-RPC and user-enumeration protections with verification state reporting</li></ul>' +
                '<h4>1.3.1</h4><ul><li>Escape &lt;/script sequences inside JSON-LD to prevent premature script-block termination</li><li>Connector validation: reject non-head content (robots.txt, .htaccess, llms.txt) from wp_head injection</li></ul>' +
                '<h4>0.3.0</h4><ul><li>Automatic updates via WordPress update system</li><li>Full i18n: German, Spanish, French, Italian, Portuguese</li><li>Deep-link pairing: arrive from the GetSafe 360 AI dashboard with code pre-filled</li><li>Brand icon in admin menu and page header</li></ul>' +
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
