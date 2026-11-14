=== GetSafe 360 AI ===
Contributors: WPORG_USERNAME
Tags: security, site health, seo, performance, accessibility
Requires at least: 5.6
Tested up to: 7.1
Requires PHP: 7.2
Stable tag: 1.11.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Website intelligence for WordPress: health, security, SEO, speed and accessibility checks in plain words, with one-click fixes you can undo.

== Description ==

GetSafe 360 AI checks your website the way a visitor, a search engine and an attacker see it, and adds the view from inside WordPress. Every finding is explained in plain words, with what it means for your site and how to fix it. Many problems can be fixed with one click, and every reversible fix can be undone.

It works alongside the plugins you already use, such as your SEO, caching or firewall plugin. Nothing needs to be replaced.

= What it checks =

* **Security:** security headers, HTTPS, XML-RPC, user enumeration, version disclosure, the theme and plugin file editor, admin accounts and open registration, security keys, the database prefix, wp-config.php permissions, debug mode and debug logs
* **Updates:** WordPress core, plugins and themes, plugins with known vulnerabilities, the PHP version, automatic updates
* **Integrity:** WordPress core files that differ from the official release, PHP files that do not belong in wp-admin, wp-includes or uploads, hidden plugins
* **SEO:** title and meta description, canonical URL, noindex, H1 headings, structured data (JSON-LD), social sharing tags, sitemap
* **Speed:** scripts and images per page, page size, compression, browser caching, page and object cache, OPcache, autoloaded options, expired transients, post revisions, scheduled tasks, memory limit
* **Accessibility:** image alt text, page language, heading structure
* **Email:** SPF and DMARC records that protect your domain against spoofing

= What it can fix, after you approve =

* Block XML-RPC and user enumeration
* Add security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
* Build a Content-Security-Policy from what your pages really load: tested first in report-only mode, which blocks nothing, reviewed with AI, then switched on
* Lock the file editor, give new accounts the Subscriber role, make wp-config.php private
* Switch on automatic security releases and plugin auto-updates
* Update outdated plugins with a restore point, put back automatically if the site stops loading
* Restore modified WordPress core files from the official release, checked against the official checksums
* Remove expired transients and old post revisions (the newest five per post are kept)
* Add missing SEO markup to the page head: meta description, canonical URL, social sharing tags, structured data

Low-risk protections can be applied automatically if you allow it. Anything that touches content or the database waits for your click.

= Privacy first =

The checks send flags and counts, never usernames, email addresses, passwords or file contents. The one exception is a WordPress core file that differs from the official release: for review, only its changed lines are sent, and only for files in wp-admin, wp-includes and the WordPress root (never wp-config.php, plugins, themes or uploads). "External services" below lists every request the plugin makes.

= Six languages =

The plugin and the GetSafe 360 AI dashboard speak English, German, Spanish, French, Italian and Portuguese.

= How it works =

The plugin connects your site to a free GetSafe 360 AI account, where you see the results and choose the fixes. It does nothing until you connect it. AI-assisted fixes use a monthly allowance that comes with the account.

== Installation ==

1. Install and activate the plugin.
2. Sign in at [getsafe360.ai](https://www.getsafe360.ai), or create a free account, and add your site.
3. On your site's WordPress page in the dashboard, click "Generate pairing code". The code is valid for 10 minutes.
4. In WordPress, open **GetSafe 360 AI** in the admin menu, enter the 6-digit code and click **Connect**.

The dashboard can also open the plugin page with the code already filled in.

To disconnect, open **GetSafe 360 AI** and click **Disconnect**. Deactivating the plugin stops all access as well; deleting it removes everything it stored.

== Frequently Asked Questions ==

= Does the plugin change anything on its own? =

No. It only acts when you approve a fix in your dashboard, or for the low-risk protections you allowed to be applied automatically. Every reversible change can be undone from the dashboard.

= What happens if a fix breaks my site? =

Plugin updates and core file restores check that the site still loads afterwards. If it does not, the plugin puts the previous files back immediately. Restore points are kept for 14 days.

= Will a Content-Security-Policy break my site? =

The policy is tested first in report-only mode, which never blocks anything. Browsers report what the policy would have blocked; you review those reports, with an AI explanation for each, before the policy is switched on. Switching it on can be undone.

= Does it replace my security, SEO or caching plugin? =

No. It checks the whole site and fixes what is missing, and it works next to Yoast SEO, Rank Math, Wordfence, Solid Security, WP Rocket and others.

= Does it work on multisite? =

The checks do. Plugin updates are left to the network admin on multisite networks.

= Does it need FTP credentials? =

Most fixes do not. Plugin updates and core file restores need WordPress to be able to write files directly, as on most hosts.

= How is the connection secured? =

Connecting stores a site key in your database. GetSafe 360 AI sends a hash of that key with every request to the plugin's REST endpoints (under /wp-json/getsafe360/v1/); requests without it are refused. Only the /ping endpoint, which returns the plugin version and the site address, is public.

= I used the "GetSafe360 Connector" plugin before. =

This plugin replaces it. Deactivate and delete "GetSafe360 Connector" after installing this one; your connection and settings are kept.

== External services ==

This plugin connects your site to GetSafe 360 AI (https://www.getsafe360.ai), a service run by GetSafe 360 AI. It does not contact any server until you connect it.

**When you connect:** the plugin sends the pairing code, your site URL, the WordPress version and the plugin version to https://www.getsafe360.ai/api/connect/handshake, and receives a site ID and site key in return.

**While connected:** GetSafe 360 AI sends requests to your site's REST endpoints to run checks and the fixes you approve. The responses contain versions (WordPress, PHP, database, plugins and theme), the list of active plugins, the state of the protections listed above, and flags and counts from the health checks. For a core file that differs from the official release, the response contains only the changed lines (never wp-config.php, plugins, themes or uploads).

**Content-Security-Policy reports:** while a Content-Security-Policy test or policy from GetSafe 360 AI is active, your visitors' browsers send violation reports to https://www.getsafe360.ai. Only the directive, the blocked source, a count and one sample page path are kept, for 30 days; IP addresses are not stored.

**WordPress.org:** to restore a modified core file, the plugin downloads the official copy from https://core.svn.wordpress.org and checks it against the official checksum. Plugin updates use the standard WordPress update system.

GetSafe 360 AI [Terms of Service](https://www.getsafe360.ai/terms) and [Privacy Policy](https://www.getsafe360.ai/privacy).

== Changelog ==

= 1.11.0 =
* New name: GetSafe 360 AI (formerly GetSafe360 Connector)
* Ready for the WordPress.org plugin directory: updates now come from WordPress.org
* Deleting the plugin removes everything it stored
* SEO markup in the page head is checked again on output: only meta tags, link tags and valid JSON-LD are printed
* Translations load at the right time (no more notice on WordPress 6.7 and later)
* Security hardening of admin form input and output

= 1.10.0 =
* Content-Security-Policy support: test a policy built from what your pages load in report-only mode, without blocking anything
* Every policy is checked (known rules only, valid sources, no header injection) before it is sent
* Undo of a header change now restores only the headers that change touched

= 1.9.0 =
* Core file integrity: lists WordPress core files that differ from the official release and PHP files in wp-admin or wp-includes that do not belong to WordPress
* One-click restore of the official files and quarantine of unexpected files, both with undo and automatic recovery if the site stops loading

= 1.8.0 =
* Update outdated plugins with a restore point; put back immediately if the site stops loading

= 1.7.0 =
* New one-click fixes: file editor lock, Subscriber as default role, private wp-config.php, automatic security releases and plugin auto-updates, cleanup of expired transients and old revisions

== Upgrade Notice ==

= 1.11.0 =
New name: GetSafe 360 AI. Future updates come from WordPress.org.
