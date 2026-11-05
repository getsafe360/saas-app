// lib/engine/wordpress/audit-rules.ts
//
// Checks fed by the connector's read-only site audit (plugin ≥ 1.6). Without
// the audit every input is null, so each check stays `unknown`.

import { type Rule, type RuleOutcome, unknown } from '../rules';
import type { WordPressFacts } from './facts';

const NEEDS_AUDIT = 'Needs the GetSafe 360 plugin 1.6 or newer.';

const KB = 1024;
const MB = 1024 * KB;

/**
 * End of security support per PHP branch (php.net/supported-versions).
 * Branches missing here and older than 8.2 are already end-of-life.
 */
export const PHP_SECURITY_SUPPORT_ENDS: Readonly<Record<string, string>> = {
  '8.1': '2025-12-31',
  '8.2': '2026-12-31',
  '8.3': '2027-12-31',
  '8.4': '2028-12-31',
  '8.5': '2029-12-31',
};

const EOL_WARNING_DAYS = 90;

export function phpSupportStatus(
  version: string,
  now: Date = new Date(),
): { branch: string; endsOn: string | null; status: 'supported' | 'ending' | 'eol' | 'unknown' } {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) return { branch: version, endsOn: null, status: 'unknown' };
  const [major, minor] = [Number(match[1]), Number(match[2])];
  const branch = `${major}.${minor}`;
  const endsOn = PHP_SECURITY_SUPPORT_ENDS[branch] ?? null;

  if (!endsOn) {
    // Older than every listed branch → long out of support; newer → too new to list yet.
    const oldest = Object.keys(PHP_SECURITY_SUPPORT_ENDS)[0].split('.').map(Number);
    const older = major < oldest[0] || (major === oldest[0] && minor < oldest[1]);
    return { branch, endsOn: null, status: older ? 'eol' : 'supported' };
  }

  const end = new Date(`${endsOn}T23:59:59Z`).getTime();
  if (now.getTime() > end) return { branch, endsOn, status: 'eol' };
  if (end - now.getTime() < EOL_WARNING_DAYS * 24 * 3600 * 1000) return { branch, endsOn, status: 'ending' };
  return { branch, endsOn, status: 'supported' };
}

function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.round(bytes / KB)} KB`;
}

/** Pass/fail for a boolean where `true` is the healthy value. */
function healthyWhenTrue(
  value: boolean | null,
  pass: string,
  fail: Omit<RuleOutcome, 'status'>,
): RuleOutcome {
  if (value === null) return unknown(NEEDS_AUDIT);
  return value ? { status: 'pass', summary: pass } : { status: 'fail', ...fail };
}

export const WORDPRESS_AUDIT_RULES: ReadonlyArray<Rule<WordPressFacts>> = [
  // ---------- security ----------
  {
    id: 'wp-admin-username',
    category: 'security',
    title: 'Predictable admin username',
    severity: 'high',
    source: 'connector',
    recommendation:
      'Create a new administrator with a unique username, move content to it, then delete the "admin" account.',
    fix: { fixerId: 'wordpress-replace-admin-user', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(
        security.hasAdminUsername === null ? null : !security.hasAdminUsername,
        'No administrator uses "admin" or "administrator" as username.',
        {
          summary: 'An administrator account uses the username "admin" or "administrator", the first guess of every brute-force attack.',
          impact: { scoreGain: 5, riskReduction: 14 },
        },
      ),
  },
  {
    id: 'wp-admin-count',
    category: 'security',
    title: 'Number of administrators',
    severity: 'low',
    source: 'connector',
    recommendation: 'Keep administrator accounts to the people who need them; give others Editor or Author roles.',
    evaluate: ({ security }) => {
      if (security.adminCount === null) return unknown(NEEDS_AUDIT);
      const count = security.adminCount;
      return count > 2
        ? {
            status: 'warn',
            summary: `${count} accounts have full administrator rights.`,
            observed: String(count),
            impact: { scoreGain: 2, riskReduction: 6 },
          }
        : { status: 'pass', summary: `${count} administrator account${count === 1 ? '' : 's'}.`, observed: String(count) };
    },
  },
  {
    id: 'wp-open-admin-registration',
    category: 'security',
    title: 'Open registration as administrator',
    severity: 'critical',
    source: 'connector',
    recommendation: 'Set Settings → General → New User Default Role to Subscriber, or turn off "Anyone can register".',
    fix: { fixerId: 'wordpress-fix-default-role', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(
        security.openAdminRegistration === null ? null : !security.openAdminRegistration,
        'New registrations cannot become administrators.',
        {
          summary: 'Anyone can register, and new accounts become administrators. This is a common sign of a hacked site.',
          impact: { scoreGain: 20, riskReduction: 50 },
        },
      ),
  },
  {
    id: 'wp-file-editing',
    category: 'security',
    title: 'Theme and plugin file editor',
    severity: 'medium',
    source: 'connector',
    recommendation: "Add define('DISALLOW_FILE_EDIT', true); to wp-config.php.",
    fix: { fixerId: 'wordpress-disable-file-edit', automation: 'guided', risk: 'low', reversible: true },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.fileEditDisabled, 'The built-in code editor is disabled.', {
        summary: 'Administrators can edit theme and plugin code from the dashboard; a stolen login becomes code execution.',
        impact: { scoreGain: 4, riskReduction: 12 },
      }),
  },
  {
    id: 'wp-salts',
    category: 'security',
    title: 'Security keys and salts',
    severity: 'high',
    source: 'connector',
    recommendation: 'Generate fresh keys at api.wordpress.org/secret-key/1.1/salt/ and replace them in wp-config.php.',
    fix: { fixerId: 'wordpress-rotate-salts', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.saltsConfigured, 'All eight security keys and salts are set and unique.', {
        summary: 'Security keys or salts are missing, default or duplicated, which weakens login cookies.',
        impact: { scoreGain: 6, riskReduction: 18 },
      }),
  },
  {
    id: 'wp-db-prefix',
    category: 'security',
    title: 'Database table prefix',
    severity: 'low',
    source: 'connector',
    recommendation: 'Use a custom table prefix on new installs; changing it on a live site needs a careful migration.',
    evaluate: ({ security }) => {
      if (security.dbPrefixDefault === null) return unknown(NEEDS_AUDIT);
      return security.dbPrefixDefault
        ? {
            status: 'warn',
            summary: 'Tables use the default "wp_" prefix, which makes automated SQL-injection payloads easier.',
            impact: { scoreGain: 1, riskReduction: 3 },
          }
        : { status: 'pass', summary: 'Tables use a custom prefix.' };
    },
  },
  {
    id: 'wp-https',
    category: 'security',
    title: 'HTTPS site address',
    severity: 'high',
    source: 'connector',
    recommendation: 'Install a TLS certificate and set both WordPress and Site Address to https:// in Settings → General.',
    fix: { fixerId: 'wordpress-enable-https', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.homeHttps, 'The site address uses HTTPS.', {
        summary: 'The site address is configured as http://, so logins and forms travel unencrypted.',
        impact: { scoreGain: 10, riskReduction: 25 },
      }),
  },
  {
    id: 'wp-config-permissions',
    category: 'security',
    title: 'wp-config.php permissions',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Set wp-config.php permissions to 640 or 600 so other accounts on the server cannot read it.',
    fix: { fixerId: 'wordpress-tighten-config-permissions', automation: 'guided', risk: 'low', reversible: true },
    evaluate: ({ security }) => {
      if (security.wpConfigWorldReadable === null) return unknown('wp-config.php permissions could not be read.');
      return security.wpConfigWorldReadable
        ? {
            status: 'warn',
            summary: 'wp-config.php, which holds the database password, is readable by every account on the server.',
            impact: { scoreGain: 3, riskReduction: 10 },
          }
        : { status: 'pass', summary: 'wp-config.php is not world-readable.' };
    },
  },
  {
    id: 'wp-php-version',
    category: 'security',
    title: 'PHP version',
    severity: 'high',
    source: 'connector',
    recommendation: 'Ask your host to switch the site to PHP 8.3 or newer, after testing on a staging copy.',
    fix: { fixerId: 'wordpress-upgrade-php', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ performance }) => {
      if (!performance.phpVersion) return unknown('PHP version was not reported.');
      const support = phpSupportStatus(performance.phpVersion);
      const observed = performance.phpVersion;
      switch (support.status) {
        case 'eol':
          return {
            status: 'fail',
            summary: `PHP ${support.branch} no longer receives security fixes${support.endsOn ? ` (ended ${support.endsOn})` : ''}.`,
            observed,
            impact: { scoreGain: 10, riskReduction: 30, timeSavedMs: 300 },
          };
        case 'ending':
          return {
            status: 'warn',
            summary: `PHP ${support.branch} stops receiving security fixes on ${support.endsOn}.`,
            observed,
            impact: { scoreGain: 4, riskReduction: 10 },
          };
        case 'supported':
          return { status: 'pass', summary: `PHP ${support.branch} is supported.`, observed };
        default:
          return unknown(`PHP version "${observed}" could not be interpreted.`);
      }
    },
  },

  // ---------- stability ----------
  {
    id: 'wp-debug-log',
    category: 'stability',
    title: 'Debug log',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Turn off WP_DEBUG_LOG on production, or write the log outside the web root.',
    fix: { fixerId: 'wordpress-disable-debug', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ security }) => {
      if (security.debugLog === null) return unknown(NEEDS_AUDIT);
      return security.debugLog
        ? {
            status: 'warn',
            summary: 'Errors are logged to wp-content/debug.log, which is publicly downloadable by default.',
            impact: { scoreGain: 3, riskReduction: 8 },
          }
        : { status: 'pass', summary: 'The debug log is off.' };
    },
  },
  {
    id: 'wp-inactive-plugins',
    category: 'stability',
    title: 'Inactive plugins',
    severity: 'low',
    source: 'connector',
    recommendation: 'Delete plugins you no longer use; inactive code can still be exploited.',
    evaluate: ({ plugins }) => {
      if (plugins.inactive === null) return unknown(NEEDS_AUDIT);
      return plugins.inactive > 0
        ? {
            status: 'warn',
            summary: `${plugins.inactive} installed plugin(s) are inactive.`,
            observed: String(plugins.inactive),
            impact: { scoreGain: 2, riskReduction: 5 },
          }
        : { status: 'pass', summary: 'No inactive plugins.' };
    },
  },
  {
    id: 'wp-unused-themes',
    category: 'stability',
    title: 'Unused themes',
    severity: 'low',
    source: 'connector',
    recommendation: 'Keep the active theme and one default theme as a fallback; delete the rest.',
    evaluate: ({ themes }) => {
      if (themes.inactive === null) return unknown(NEEDS_AUDIT);
      return themes.inactive > 1
        ? {
            status: 'warn',
            summary: `${themes.inactive} unused themes are installed.`,
            observed: String(themes.inactive),
            impact: { scoreGain: 1, riskReduction: 4 },
          }
        : { status: 'pass', summary: 'No surplus themes installed.' };
    },
  },
  {
    id: 'wp-theme-update',
    category: 'stability',
    title: 'Active theme updates',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Update the active theme (use a child theme for customizations so updates are safe).',
    fix: { fixerId: 'wordpress-update-theme', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ themes }) => {
      if (themes.activeUpdateAvailable === null) return unknown('Theme update data is not available yet.');
      return themes.activeUpdateAvailable
        ? { status: 'fail', summary: 'An update is available for the active theme.', impact: { scoreGain: 4, riskReduction: 10 } }
        : { status: 'pass', summary: 'The active theme is up to date.' };
    },
  },
  {
    id: 'wp-autoload-size',
    category: 'stability',
    title: 'Autoloaded options',
    severity: 'high',
    source: 'connector',
    recommendation: 'Find large autoloaded options (often left by removed plugins) and set them to not autoload or delete them.',
    fix: { fixerId: 'wordpress-trim-autoload', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ database }) => {
      const bytes = database.autoloadBytes;
      if (bytes === null) return unknown(NEEDS_AUDIT);
      const observed = formatBytes(bytes);
      if (bytes > 1 * MB) {
        return {
          status: 'fail',
          summary: `${observed} of options load on every request; above 1 MB this slows every page.`,
          observed,
          impact: { scoreGain: 8, timeSavedMs: 400 },
        };
      }
      if (bytes > 600 * KB) {
        return {
          status: 'warn',
          severity: 'medium',
          summary: `${observed} of options load on every request.`,
          observed,
          impact: { scoreGain: 3, timeSavedMs: 150 },
        };
      }
      return { status: 'pass', summary: `${observed} of autoloaded options.`, observed };
    },
  },
  {
    id: 'wp-expired-transients',
    category: 'stability',
    title: 'Expired transients',
    severity: 'low',
    source: 'connector',
    recommendation: 'Clean up expired transients; a persistent object cache prevents the build-up.',
    fix: { fixerId: 'wordpress-clean-transients', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ database }) => {
      if (database.expiredTransients === null) return unknown(NEEDS_AUDIT);
      return database.expiredTransients > 1000
        ? {
            status: 'warn',
            summary: `${database.expiredTransients} expired transients are still stored.`,
            observed: String(database.expiredTransients),
            impact: { scoreGain: 1, timeSavedMs: 50 },
          }
        : { status: 'pass', summary: 'Expired transients are under control.' };
    },
  },
  {
    id: 'wp-revisions',
    category: 'stability',
    title: 'Post revisions',
    severity: 'low',
    source: 'connector',
    recommendation: "Limit revisions with define('WP_POST_REVISIONS', 10); and remove old ones.",
    fix: { fixerId: 'wordpress-limit-revisions', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ database }) => {
      if (database.revisions === null) return unknown(NEEDS_AUDIT);
      return database.revisions > 5000
        ? {
            status: 'warn',
            summary: `${database.revisions} post revisions are stored.`,
            observed: String(database.revisions),
            impact: { scoreGain: 1, timeSavedMs: 30 },
          }
        : { status: 'pass', summary: `${database.revisions} post revisions.`, observed: String(database.revisions) };
    },
  },
  {
    id: 'wp-cron',
    category: 'stability',
    title: 'Scheduled tasks (WP-Cron)',
    severity: 'medium',
    source: 'connector',
    recommendation: 'If DISABLE_WP_CRON is set, add a real server cron that calls wp-cron.php every 5 minutes.',
    fix: { fixerId: 'wordpress-fix-cron', automation: 'guided', risk: 'low', reversible: true },
    evaluate: ({ cron }) => {
      if (cron.overdue === null || cron.disabled === null) return unknown(NEEDS_AUDIT);
      if (cron.disabled && cron.overdue > 0) {
        return {
          status: 'fail',
          summary: `WP-Cron is disabled and ${cron.overdue} task(s) are more than an hour overdue; no replacement cron seems to run.`,
          observed: String(cron.overdue),
          impact: { scoreGain: 5, riskReduction: 8 },
        };
      }
      if (cron.overdue > 20) {
        return {
          status: 'warn',
          summary: `${cron.overdue} scheduled tasks are more than an hour overdue.`,
          observed: String(cron.overdue),
          impact: { scoreGain: 3, riskReduction: 5 },
        };
      }
      return { status: 'pass', summary: 'Scheduled tasks run on time.' };
    },
  },

  // ---------- performance ----------
  {
    id: 'wp-page-cache',
    category: 'performance',
    title: 'Page cache',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Enable a page cache plugin or your host’s built-in page cache.',
    fix: { fixerId: 'wordpress-enable-page-cache', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ performance }) => {
      if (performance.pageCache === null) return unknown(NEEDS_AUDIT);
      return performance.pageCache
        ? { status: 'pass', summary: 'A WordPress page cache is active.' }
        : {
            status: 'warn',
            confidence: 'medium',
            summary: 'No WordPress page cache was found. A server or CDN cache may still be in place.',
            impact: { scoreGain: 8, timeSavedMs: 600 },
          };
    },
  },
  {
    id: 'wp-opcache',
    category: 'performance',
    title: 'PHP OPcache',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Ask your host to enable OPcache.',
    evaluate: ({ performance }) => {
      if (performance.opcache === null) return unknown(NEEDS_AUDIT);
      return performance.opcache
        ? { status: 'pass', summary: 'OPcache is enabled.' }
        : { status: 'fail', summary: 'OPcache is off, so PHP recompiles code on every request.', impact: { scoreGain: 6, timeSavedMs: 250 } };
    },
  },
  {
    id: 'wp-memory-limit',
    category: 'performance',
    title: 'PHP memory limit',
    severity: 'low',
    source: 'connector',
    recommendation: 'Raise memory_limit to at least 256M with your host.',
    evaluate: ({ performance }) => {
      const bytes = performance.memoryLimitBytes;
      if (bytes === null) return unknown(NEEDS_AUDIT);
      if (bytes === -1) return { status: 'pass', summary: 'No PHP memory limit is set.' };
      const observed = formatBytes(bytes);
      return bytes < 128 * MB
        ? { status: 'warn', summary: `PHP may use only ${observed}; larger sites run out of memory.`, observed, impact: { scoreGain: 2 } }
        : { status: 'pass', summary: `PHP memory limit is ${observed}.`, observed };
    },
  },

  // ---------- red flags ----------
  {
    id: 'red-flag-uploads-php',
    category: 'red-flags',
    title: 'PHP files in uploads',
    severity: 'high',
    source: 'connector',
    recommendation:
      'Review PHP files in wp-content/uploads; uploads should only hold media. Block PHP execution there at the server.',
    fix: { fixerId: 'wordpress-review-uploads-php', automation: 'guided', risk: 'high', reversible: false },
    evaluate: ({ redFlags }) => {
      if (redFlags.uploadsPhpFiles === null) return unknown('The uploads folder could not be scanned in time.');
      return redFlags.uploadsPhpFiles > 0
        ? {
            status: 'fail',
            summary: `${redFlags.uploadsPhpFiles} PHP file(s) found in the uploads folder, a common place for backdoors.`,
            observed: String(redFlags.uploadsPhpFiles),
            impact: { scoreGain: 12, riskReduction: 35 },
          }
        : { status: 'pass', summary: 'No PHP files in the uploads folder.' };
    },
  },
];
