// saas-ux/app/[locale]/docs/wordpress-connector/page.tsx
// English only until full i18n at MVP launch.
import type { Metadata } from "next";
import { Link } from "@/navigation";

export const metadata: Metadata = {
  title: "WordPress Connector",
  description:
    "Install the GetSafe 360 AI Connector plugin, pair your WordPress site with a 6-digit code, and start AI-powered optimizations.",
};

export default function WordPressConnectorDocsPage() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1>WordPress Connector</h1>
      <p className="lead">
        The <strong>GetSafe 360 AI Connector</strong> plugin is the bridge between your
        WordPress site and the GetSafe 360 AI platform. Once connected, the platform can
        diagnose internal WordPress details and safely apply AI-assisted fixes — things
        that aren't possible with external-only analysis.
      </p>

      {/* Why connect */}
      <h2>Why connect?</h2>
      <p>
        GetSafe 360 AI can already inspect your public website from the outside — including
        performance, SEO, accessibility, security headers, content quality, structured data,
        and CMS signals. Connecting your site adds the secure layer required to diagnose
        internal WordPress details and safely apply AI-assisted fixes.
      </p>

      <div className="not-prose grid sm:grid-cols-2 gap-4 my-6">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            Available without connection
          </p>
          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {[
              "External website analysis",
              "Performance and SEO checks",
              "Accessibility and content review",
              "Security header inspection",
              "Structured data validation",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400 mb-2">
            Unlocked after connection
          </p>
          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {[
              "AI-powered optimization workflows",
              "Automated WordPress fixes",
              "CMS/plugin-level diagnostics",
              "Continuous monitoring",
              "Safe repair actions with audit history",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-sky-500 mt-0.5">✦</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* How it works */}
      <h2>How it works</h2>
      <p>
        The connector uses a <strong>one-time 6-digit pairing code</strong> to establish
        a secure, encrypted link between your WordPress site and your GetSafe 360 AI
        account. No passwords leave WordPress, and no persistent admin credentials are
        stored on our servers.
      </p>
      <p>
        After pairing, the plugin exposes a private REST API (<code>/wp-json/getsafe360/v1/</code>)
        authenticated with a site-specific token. The GetSafe 360 AI platform uses this
        to push optimized fixes and pull diagnostic data — always with your explicit approval.
      </p>

      {/* Installation */}
      <h2>Installation</h2>
      <ol>
        <li>
          <strong>Download the plugin</strong> — get{" "}
          <a href="/wp-plugin/getsafe360-connector.zip" download>
            getsafe360-connector.zip
          </a>{" "}
          (≈ 30 KB).
        </li>
        <li>
          In your WordPress admin go to <strong>Plugins → Add New → Upload Plugin</strong>,
          select the ZIP, click <em>Install Now</em>, then <em>Activate</em>.
        </li>
        <li>
          A new <strong>GetSafe 360 AI</strong> menu item appears in your sidebar.
        </li>
      </ol>

      {/* Pairing */}
      <h2>Pairing your site</h2>
      <h3>Standard flow (copy-paste)</h3>
      <ol>
        <li>
          Log in to your{" "}
          <Link href="/dashboard" className="text-sky-600 dark:text-sky-400 underline">
            GetSafe 360 AI dashboard
          </Link>.
        </li>
        <li>
          Open the site cockpit for your WordPress site and click{" "}
          <strong>"Generate Pairing Code"</strong>.
        </li>
        <li>Copy the 6-digit code (valid for 10 minutes).</li>
        <li>
          In WordPress admin, go to <strong>GetSafe 360 AI → Settings</strong>, paste the
          code in the input field, and click <strong>Connect to GetSafe 360 AI</strong>.
        </li>
        <li>A green "Connected" status confirms the link.</li>
      </ol>

      <h3>Deep-link flow (zero copy-paste)</h3>
      <p>
        From the GetSafe 360 AI dashboard, click <strong>"Open in WordPress Admin"</strong>.
        This opens your <code>wp-admin</code> with the pairing code pre-filled — just click
        Connect. No copy-paste required.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The deep-link URL format is:{" "}
        <code>{"https://your-site.com/wp-admin/admin.php?page=getsafe360&gs360_code=XXXXXX"}</code>
      </p>

      {/* Auto-updates */}
      <h2>Automatic updates</h2>
      <p>
        The plugin uses WordPress's native update system (
        <a href="https://make.wordpress.org/core/2021/06/29/introducing-update-uri-plugin-header-in-wordpress-5-8/">
          Update URI header
        </a>
        , introduced in WP 5.8). When a new version is published:
      </p>
      <ul>
        <li>
          WordPress shows a standard update notification in your plugins list.
        </li>
        <li>
          Use the built-in <strong>"Enable auto-updates"</strong> toggle to let WordPress
          install updates automatically.
        </li>
        <li>
          Click <strong>"View details"</strong> in the plugins list to see the full changelog
          and release notes before updating.
        </li>
      </ul>

      {/* REST API endpoints */}
      <h2>Plugin REST API endpoints</h2>
      <p>
        All endpoints are at <code>{"https://your-site.com/wp-json/getsafe360/v1/"}</code>.
        The <code>status</code>, <code>push</code>, and <code>pull</code> endpoints require
        an <code>X-API-Key</code> header (SHA-256 hash of your site token, managed
        automatically by the platform).
      </p>

      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 text-left">
              <th className="py-2 pr-4 font-semibold text-slate-900 dark:text-slate-100">Method</th>
              <th className="py-2 pr-4 font-semibold text-slate-900 dark:text-slate-100">Endpoint</th>
              <th className="py-2 font-semibold text-slate-900 dark:text-slate-100">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {[
              ["GET", "/ping", "Public health check — returns version and site URL."],
              ["GET", "/status", "Returns WordPress and plugin version info (auth required)."],
              ["POST", "/push", "Receives AI repair snippets and applies them to <head> (auth required)."],
              ["GET", "/pull", "Returns plugins, theme, PHP/MySQL version, and site data (auth required)."],
            ].map(([method, path, desc]) => (
              <tr key={path}>
                <td className="py-2 pr-4">
                  <code className="text-xs font-mono bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                    {method}
                  </code>
                </td>
                <td className="py-2 pr-4">
                  <code className="text-xs font-mono text-sky-700 dark:text-sky-400">{path}</code>
                </td>
                <td className="py-2 text-slate-600 dark:text-slate-400">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Troubleshooting */}
      <h2>Troubleshooting</h2>
      <dl>
        <dt>
          <strong>Pairing code expired</strong>
        </dt>
        <dd>
          Codes are valid for 10 minutes. Generate a fresh code in the dashboard and try
          again. Make sure the code was generated for the exact site URL shown at the bottom
          of the connector page.
        </dd>
        <dt>
          <strong>Connection timed out</strong>
        </dt>
        <dd>
          Check that your WordPress server can make outbound HTTPS requests to{" "}
          <code>getsafe360.ai</code>. Some managed hosts block outbound connections —
          whitelist <code>*.getsafe360.ai</code> in your firewall if needed.
        </dd>
        <dt>
          <strong>SSL certificate error</strong>
        </dt>
        <dd>
          Enable <em>WP_DEBUG</em> to see the full error. Outdated CA bundles on old PHP
          installations are the most common cause — ask your host to update the server's
          SSL certificates.
        </dd>
        <dt>
          <strong>"View details" not appearing in plugins list</strong>
        </dt>
        <dd>
          This requires a successful update check (the <code>/api/wp-plugin/info</code>{" "}
          endpoint must return HTTP 200). If the download URL isn't configured on the server
          side, the endpoint returns 503 and no update metadata is served.
        </dd>
      </dl>

      <h2>Need help?</h2>
      <p>
        Visit{" "}
        <a href="https://www.getsafe360.ai/support">getsafe360.ai/support</a> or open a
        ticket directly from your dashboard.
      </p>
    </article>
  );
}
