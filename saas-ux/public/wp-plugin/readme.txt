=== GetSafe360 Connector ===
Contributors: WPORG_USERNAME
Tags: security, site health, performance, seo, hardening
Requires at least: 5.6
Tested up to: 7.1
Requires PHP: 7.2
Stable tag: 1.11.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Health, security and speed checks from inside WordPress, with safe one-click fixes you can undo. Connects your site to GetSafe 360 AI.

== Description ==

GetSafe 360 AI checks websites for security, performance, SEO and accessibility problems. From the outside it sees what every visitor sees. This plugin adds the inside view: it lets your GetSafe 360 dashboard check WordPress itself and apply fixes you approve, each with an undo.

**What the connected dashboard can check**

* Security settings: XML-RPC, user enumeration, the theme and plugin file editor, the default role for new accounts, wp-config.php permissions, security headers
* Updates: WordPress core, plugins and themes, and whether automatic security releases are on
* Core file integrity: WordPress core files that differ from the official release, and PHP files in wp-admin or wp-includes that do not belong there
* Performance and database health: autoloaded options, expired transients, post revisions, object and page cache
* Red flags such as PHP files in the uploads folder

**What it can fix, after you approve each change**

* Switch on XML-RPC and user-enumeration protection
* Add security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
* Build a Content-Security-Policy for your site: test it first in report-only mode, which blocks nothing, then switch it on
* Lock the file editor, give new accounts the Subscriber role, make wp-config.php private
* Switch on automatic WordPress security releases and plugin auto-updates
* Update an outdated plugin with a restore point, and put it back automatically if the site stops loading
* Restore modified WordPress core files from the official release, checked against the official checksums
* Remove expired transients and old post revisions (the newest five per post are kept)
* Add SEO markup to the page head: meta tags, link tags and JSON-LD structured data

Every reversible change comes with an exact undo. Low-risk protections can be applied automatically if you allow it; anything that touches content or the database waits for your click.

**Privacy first**

The checks send flags and counts, never usernames, email addresses, passwords or file contents. The one exception is a WordPress core file that differs from the official release: to review it, GetSafe 360 receives only the changed lines, only for files in wp-admin, wp-includes and the WordPress root (never wp-config.php, plugins, themes or uploads). See "External services" below for every request the plugin makes.

**Languages**

The plugin and the GetSafe 360 dashboard are available in English, German, Spanish, French, Italian and Portuguese.

**You need a GetSafe 360 account**

The plugin does nothing on its own until you connect it. A free GetSafe 360 account covers the checks and the one-click fixes; paid plans add client reports, white-label branding and higher AI usage limits. See [pricing](https://www.getsafe360.ai/pricing).

== Installation ==

1. Install and activate the plugin.
2. Sign in at [getsafe360.ai](https://www.getsafe360.ai) (or create a free account) and add your site.
3. On your site's WordPress page in the dashboard, click "Generate pairing code". The code is valid for 10 minutes.
4. In WordPress, open **GetSafe 360 AI** in the admin menu, enter the 6-digit code and click **Connect**.

The dashboard can also open the plugin page with the code already filled in.

To disconnect, open **GetSafe 360 AI** and click **Disconnect**. Deactivating the plugin removes the site's access as well.

== Frequently Asked Questions ==

= Does the plugin change anything on its own? =

No. It only acts when your GetSafe 360 dashboard sends an action you approved, or one of the low-risk protections you allowed to be applied automatically. Every reversible change can be undone from the dashboard.

= What happens if a fix breaks my site? =

Plugin updates and core file restores check that the site still loads afterwards. If it does not, the plugin puts the previous files back immediately. Restore points are kept for 14 days.

= Will a Content-Security-Policy break my site? =

The policy is tested first in report-only mode, which never blocks anything. Browsers report what the policy would have blocked; you and the AI review those reports before the policy is switched on, and switching it on can be undone.

= Does it work on multisite? =

The checks do. Plugin updates are left to the network admin on multisite networks.

= Does it need FTP credentials? =

Most actions do not. Plugin updates and core file restores need WordPress to be able to write files directly, as on most hosts.

= How does the dashboard authenticate? =

Connecting stores a site key in your database. GetSafe 360 sends a hash of that key with every request to the plugin's REST endpoints (under /wp-json/getsafe360/v1/); requests without it are refused. Only the /ping endpoint, which returns the plugin version and the site address, is public.

== External services ==

This plugin connects your site to GetSafe 360 AI (https://www.getsafe360.ai), a service run by GetSafe 360 AI. It does not contact any server until you connect it.

**When you connect:** the plugin sends the pairing code, your site URL, the WordPress version and the plugin version to https://www.getsafe360.ai/api/connect/handshake, and receives a site ID and site key in return.

**While connected:** GetSafe 360 sends requests to your site's REST endpoints to run checks and the actions you approve. The responses contain versions (WordPress, PHP, database, plugins and theme), the list of active plugins, the state of the protections listed above, and flags and counts from the health checks. For a core file that differs from the official release, the response contains only the changed lines (never wp-config.php, plugins, themes or uploads).

**Content-Security-Policy reports:** while a Content-Security-Policy test or policy from GetSafe 360 is active, your visitors' browsers send violation reports to https://www.getsafe360.ai. GetSafe 360 keeps only the directive, the blocked source, a count and one sample page path, for 30 days; it does not store IP addresses.

**WordPress.org:** to restore a modified core file, the plugin downloads the official copy from https://core.svn.wordpress.org and checks it against the official checksum. Plugin updates use the standard WordPress update system.

GetSafe 360 AI [Terms of Service](https://www.getsafe360.ai/terms) and [Privacy Policy](https://www.getsafe360.ai/privacy).

== Changelog ==

= 1.11.0 =
* Ready for the WordPress.org plugin directory: updates now come from WordPress.org
* SEO markup in the page head is checked again on output: only meta tags, link tags and valid JSON-LD are printed
* Translations load at the right time (no more notice on WordPress 6.7 and later)
* Security hardening of admin form input and output

= 1.10.0 =
* Content-Security-Policy support: GetSafe 360 can test a policy built from what your pages load in report-only mode, without blocking anything; reports go only to GetSafe 360
* Every policy is checked (known rules only, valid sources, no header injection) before it is sent
* Undo of a header change now restores only the headers that change touched

= 1.9.0 =
* Core file integrity: lists WordPress core files that differ from the official release and PHP files in wp-admin or wp-includes that do not belong to WordPress
* One-click restore of the official files and quarantine of unexpected files, both with undo and automatic recovery if the site stops loading

= 1.8.0 =
* Update outdated plugins from GetSafe 360 with a restore point; put back immediately if the site stops loading

= 1.7.0 =
* New one-click fixes: file editor lock, Subscriber as default role, private wp-config.php, automatic security releases and plugin auto-updates, cleanup of expired transients and old revisions

= 1.6.0 =
* Read-only site audit: security settings, updates, performance, database and cron health, red flags

= 1.5.0 =
* Security headers with exact undo

== Upgrade Notice ==

= 1.11.0 =
Future updates come from WordPress.org. Hardens the SEO markup output.
