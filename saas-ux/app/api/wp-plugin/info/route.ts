import { NextResponse } from 'next/server';

// Update channel of the old "GetSafe360 Connector" (folder getsafe360-connector),
// versions up to 1.10.0, which updated itself from GetSafe 360.
// From 1.11.0 the plugin is "GetSafe 360 AI" in the folder getsafe-360-ai and
// updates come from WordPress.org. WordPress cannot move a plugin to a new
// folder through an update, so this channel stays frozen at 1.10.0: old
// installs are told they are current, and the dashboard asks their owners to
// install the new plugin once (settings carry over).
const PLUGIN_VERSION = '1.10.0';

export async function GET() {
    const downloadUrl = process.env.WP_PLUGIN_DOWNLOAD_URL ?? '';

    return NextResponse.json(
        {
            version: PLUGIN_VERSION,
            download_url: downloadUrl,
            tested: '7.1',
            requires: '5.0',
            requires_php: '7.2',
            icons: {
                svg: 'https://www.getsafe360.ai/icons/360.svg',
                '1x': 'https://www.getsafe360.ai/icons/360.svg',
            },
            description:
                'Secure connector between your WordPress site and <strong>GetSafe 360 AI</strong> for automated security scanning, performance monitoring, and AI-powered repairs. <a href="https://www.getsafe360.ai/docs/wordpress-connector">View documentation</a>',
            changelog:
                '<h4>1.11.0</h4><ul><li>Ready for the WordPress.org plugin directory: from this version on, updates come from WordPress.org</li><li>SEO markup in the page head is checked again on output: only meta tags, link tags and valid JSON-LD are printed</li><li>Translations load at the right time (no more notice on WordPress 6.7 and later)</li></ul>' +
                '<h4>1.10.0</h4><ul><li>Content-Security-Policy support: GetSafe 360 can test a policy built from what your pages load in report-only mode, without blocking anything; reports go only to GetSafe 360</li><li>Every policy is checked (known rules only, valid sources, no header injection) before it is sent</li><li>Undo of a header change now restores only the headers that change touched</li></ul>' +
                '<h4>1.9.0</h4><ul><li>Core file integrity: lists WordPress core files that differ from the official release and PHP files in wp-admin or wp-includes that do not belong to WordPress</li><li>For review in GetSafe 360, sends the changed lines of a core file (never wp-config.php, plugins, themes or uploads)</li><li>One-click restore of the official files (each checked against the official checksum) and quarantine of unexpected files, both with undo and automatic recovery if the site stops loading</li></ul>' +
                '<h4>1.8.0</h4><ul><li>Update outdated plugins from GetSafe 360 with a restore point: one plugin at a time, the previous version saved first, and put back immediately if the site stops loading</li><li>Undo restores the plugin files from the restore point; restore points are kept for 14 days</li><li>Never updates itself through this route, skips premium plugins without a download link, and leaves multisite networks to the network admin</li></ul>' +
                '<h4>1.7.0</h4><ul><li>New one-click fixes from GetSafe 360: lock the theme and plugin file editor, give new accounts the Subscriber role, make wp-config.php private (only when PHP keeps access), switch on automatic WordPress security releases and plugin auto-updates, remove expired transients and old post revisions (the newest 5 per post are kept)</li><li>Every reversible change returns an exact undo; the connector never makes an administrator the default role or wp-config.php world-writable</li><li>Site audit now reports automatic-update status and how many revisions can be removed</li></ul>' +
                '<h4>1.6.0</h4><ul><li>New read-only site audit for GetSafe 360 health checks: security settings, updates, performance, database and cron health, and red flags such as PHP files in uploads or modified core files</li><li>Sends flags and counts only, never usernames, email addresses or file contents</li></ul>' +
                '<h4>1.5.0</h4><ul><li>Add allowlisted security headers action (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) with exact rollback</li><li>User-enumeration guard no longer hides user endpoints from logged-in users, so the block editor keeps working</li></ul>' +
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
