// lib/engine/wordpress/audit-rules.ts
//
// Checks fed by the connector's read-only site audit (plugin ≥ 1.6). Without
// the audit every input is null, so each check stays `unknown`.

import { type Rule, type RuleOutcome, unknown } from '../rules';
import type { WordPressFacts } from './facts';

const NEEDS_AUDIT = 'common.needsAudit';
const NEEDS_PLUGIN_17 = 'common.needsPlugin17';

/** Above these counts the stability checks warn; fixers verify against the same limits. */
export const EXPIRED_TRANSIENTS_LIMIT = 1000;
export const REVISIONS_LIMIT = 5000;

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

/** Pass/fail (messages `pass`/`fail`) for a boolean where `true` is the healthy value. */
function healthyWhenTrue(
  value: boolean | null,
  impact: RuleOutcome['impact'],
): RuleOutcome {
  if (value === null) return unknown(NEEDS_AUDIT);
  return value ? { status: 'pass', message: 'pass' } : { status: 'fail', message: 'fail', impact };
}

export const WORDPRESS_AUDIT_RULES: ReadonlyArray<Rule<WordPressFacts>> = [
  // ---------- security ----------
  {
    id: 'wp-admin-username',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-replace-admin-user', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.hasAdminUsername === null ? null : !security.hasAdminUsername, {
        scoreGain: 5,
        riskReduction: 14,
      }),
  },
  {
    id: 'wp-admin-count',
    category: 'security',
    severity: 'low',
    source: 'connector',
    evaluate: ({ security }) => {
      if (security.adminCount === null) return unknown(NEEDS_AUDIT);
      const count = security.adminCount;
      return count > 2
        ? {
            status: 'warn',
            message: 'many', values: { count },
            observed: String(count),
            impact: { scoreGain: 2, riskReduction: 6 },
          }
        : { status: 'pass', message: 'ok', values: { count }, observed: String(count) };
    },
  },
  {
    id: 'wp-open-admin-registration',
    category: 'security',
    severity: 'critical',
    source: 'connector',
    // Final on purpose: the connector never restores an administrator default role.
    fix: { fixerId: 'wordpress-fix-default-role', automation: 'auto', risk: 'low', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.openAdminRegistration === null ? null : !security.openAdminRegistration, {
        scoreGain: 20,
        riskReduction: 50,
      }),
  },
  {
    id: 'wp-file-editing',
    category: 'security',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-disable-file-edit', automation: 'auto', risk: 'low', reversible: true },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.fileEditDisabled, { scoreGain: 4, riskReduction: 12 }),
  },
  {
    id: 'wp-salts',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-rotate-salts', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.saltsConfigured, { scoreGain: 6, riskReduction: 18 }),
  },
  {
    id: 'wp-db-prefix',
    category: 'security',
    severity: 'low',
    source: 'connector',
    evaluate: ({ security }) => {
      if (security.dbPrefixDefault === null) return unknown(NEEDS_AUDIT);
      return security.dbPrefixDefault
        ? {
            status: 'warn',
            message: 'default',
            impact: { scoreGain: 1, riskReduction: 3 },
          }
        : { status: 'pass', message: 'custom' };
    },
  },
  {
    id: 'wp-https',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-enable-https', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) =>
      healthyWhenTrue(security.homeHttps, { scoreGain: 10, riskReduction: 25 }),
  },
  {
    id: 'wp-config-permissions',
    category: 'security',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-tighten-config-permissions', automation: 'auto', risk: 'low', reversible: true },
    evaluate: ({ security }) => {
      if (security.wpConfigWorldReadable === null) return unknown('unknown');
      return security.wpConfigWorldReadable
        ? {
            status: 'warn',
            message: 'worldReadable',
            impact: { scoreGain: 3, riskReduction: 10 },
          }
        : { status: 'pass', message: 'ok' };
    },
  },
  {
    id: 'wp-php-version',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-upgrade-php', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ performance }) => {
      if (!performance.phpVersion) return unknown('unknown');
      const support = phpSupportStatus(performance.phpVersion);
      const observed = performance.phpVersion;
      switch (support.status) {
        case 'eol':
          return {
            status: 'fail',
            message: 'eol',
            values: { branch: support.branch, hasEnd: support.endsOn ? 'yes' : 'no', endsOn: support.endsOn ?? '' },
            observed,
            impact: { scoreGain: 10, riskReduction: 30, timeSavedMs: 300 },
          };
        case 'ending':
          return {
            status: 'warn',
            message: 'ending',
            values: { branch: support.branch, endsOn: support.endsOn ?? '' },
            observed,
            impact: { scoreGain: 4, riskReduction: 10 },
          };
        case 'supported':
          return { status: 'pass', message: 'supported', values: { branch: support.branch }, observed };
        default:
          return unknown('uninterpretable', { version: observed });
      }
    },
  },

  {
    id: 'wp-core-auto-updates',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-enable-core-auto-updates', automation: 'auto', risk: 'low', reversible: true },
    evaluate: ({ autoUpdates }) => {
      if (autoUpdates.updaterDisabled === true) {
        // The site (or its host) switched the updater off; only a wp-config.php change helps.
        return { status: 'warn', severity: 'medium', message: 'disabledByConfig', fix: null, impact: { riskReduction: 10 } };
      }
      if (autoUpdates.coreMinor === null) return unknown(NEEDS_PLUGIN_17);
      return autoUpdates.coreMinor
        ? { status: 'pass', message: 'on' }
        : { status: 'fail', message: 'off', impact: { scoreGain: 5, riskReduction: 20 } };
    },
  },

  // ---------- stability ----------
  {
    id: 'wp-debug-log',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-disable-debug', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ security }) => {
      if (security.debugLog === null) return unknown(NEEDS_AUDIT);
      return security.debugLog
        ? {
            status: 'warn',
            message: 'on',
            impact: { scoreGain: 3, riskReduction: 8 },
          }
        : { status: 'pass', message: 'off' };
    },
  },
  {
    id: 'wp-inactive-plugins',
    category: 'stability',
    severity: 'low',
    source: 'connector',
    evaluate: ({ plugins }) => {
      if (plugins.inactive === null) return unknown(NEEDS_AUDIT);
      return plugins.inactive > 0
        ? {
            status: 'warn',
            message: 'found', values: { count: plugins.inactive },
            observed: String(plugins.inactive),
            impact: { scoreGain: 2, riskReduction: 5 },
          }
        : { status: 'pass', message: 'none' };
    },
  },
  {
    id: 'wp-unused-themes',
    category: 'stability',
    severity: 'low',
    source: 'connector',
    evaluate: ({ themes }) => {
      if (themes.inactive === null) return unknown(NEEDS_AUDIT);
      return themes.inactive > 1
        ? {
            status: 'warn',
            message: 'found', values: { count: themes.inactive },
            observed: String(themes.inactive),
            impact: { scoreGain: 1, riskReduction: 4 },
          }
        : { status: 'pass', message: 'none' };
    },
  },
  {
    id: 'wp-theme-update',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-update-theme', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ themes }) => {
      if (themes.activeUpdateAvailable === null) return unknown('unknown');
      return themes.activeUpdateAvailable
        ? { status: 'fail', message: 'available', impact: { scoreGain: 4, riskReduction: 10 } }
        : { status: 'pass', message: 'upToDate' };
    },
  },
  {
    id: 'wp-plugin-auto-updates',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    // Updates can occasionally break a site, so this is never preselected (risk medium).
    fix: { fixerId: 'wordpress-enable-plugin-auto-updates', automation: 'auto', risk: 'medium', reversible: true },
    evaluate: ({ autoUpdates }) => {
      const { pluginsEnabled: enabled, pluginsTotal: total } = autoUpdates;
      if (autoUpdates.pluginsAllowed === false) {
        return { status: 'warn', severity: 'low', message: 'disabledByConfig', fix: null };
      }
      if (enabled === null || total === null) return unknown(NEEDS_PLUGIN_17);
      if (total === 0 || enabled >= total) return { status: 'pass', message: 'all', values: { total } };
      return {
        status: 'warn',
        message: enabled === 0 ? 'none' : 'some',
        values: { enabled, total },
        observed: `${enabled}/${total}`,
        impact: { scoreGain: 2, riskReduction: 8 },
      };
    },
  },
  {
    id: 'wp-autoload-size',
    category: 'stability',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-trim-autoload', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ database }) => {
      const bytes = database.autoloadBytes;
      if (bytes === null) return unknown(NEEDS_AUDIT);
      const observed = formatBytes(bytes);
      if (bytes > 1 * MB) {
        return {
          status: 'fail',
          message: 'large', values: { size: observed },
          observed,
          impact: { scoreGain: 8, timeSavedMs: 400 },
        };
      }
      if (bytes > 600 * KB) {
        return {
          status: 'warn',
          severity: 'medium',
          message: 'elevated', values: { size: observed },
          observed,
          impact: { scoreGain: 3, timeSavedMs: 150 },
        };
      }
      return { status: 'pass', message: 'ok', values: { size: observed }, observed };
    },
  },
  {
    id: 'wp-expired-transients',
    category: 'stability',
    severity: 'low',
    source: 'connector',
    fix: { fixerId: 'wordpress-clean-transients', automation: 'auto', risk: 'low', reversible: false },
    evaluate: ({ database }) => {
      if (database.expiredTransients === null) return unknown(NEEDS_AUDIT);
      return database.expiredTransients > EXPIRED_TRANSIENTS_LIMIT
        ? {
            status: 'warn',
            message: 'many', values: { count: database.expiredTransients },
            observed: String(database.expiredTransients),
            impact: { scoreGain: 1, timeSavedMs: 50 },
          }
        : { status: 'pass', message: 'ok' };
    },
  },
  {
    id: 'wp-revisions',
    category: 'stability',
    severity: 'low',
    source: 'connector',
    fix: { fixerId: 'wordpress-limit-revisions', automation: 'auto', risk: 'medium', reversible: false },
    evaluate: ({ database }) => {
      if (database.revisions === null) return unknown(NEEDS_AUDIT);
      // Once only the newest revisions per post remain, there is nothing left to clean.
      return database.revisions > REVISIONS_LIMIT && database.revisionsRemovable !== 0
        ? {
            status: 'warn',
            message: 'many', values: { count: database.revisions },
            observed: String(database.revisions),
            impact: { scoreGain: 1, timeSavedMs: 30 },
          }
        : { status: 'pass', message: 'ok', values: { count: database.revisions }, observed: String(database.revisions) };
    },
  },
  {
    id: 'wp-cron',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-fix-cron', automation: 'guided', risk: 'low', reversible: true },
    evaluate: ({ cron }) => {
      if (cron.overdue === null || cron.disabled === null) return unknown(NEEDS_AUDIT);
      if (cron.disabled && cron.overdue > 0) {
        return {
          status: 'fail',
          message: 'disabledOverdue', values: { count: cron.overdue },
          observed: String(cron.overdue),
          impact: { scoreGain: 5, riskReduction: 8 },
        };
      }
      if (cron.overdue > 20) {
        return {
          status: 'warn',
          message: 'overdue', values: { count: cron.overdue },
          observed: String(cron.overdue),
          impact: { scoreGain: 3, riskReduction: 5 },
        };
      }
      return { status: 'pass', message: 'ok' };
    },
  },

  // ---------- performance ----------
  {
    id: 'wp-page-cache',
    category: 'performance',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-enable-page-cache', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ performance }) => {
      if (performance.pageCache === null) return unknown(NEEDS_AUDIT);
      return performance.pageCache
        ? { status: 'pass', message: 'active' }
        : {
            status: 'warn',
            confidence: 'medium',
            message: 'missing',
            impact: { scoreGain: 8, timeSavedMs: 600 },
          };
    },
  },
  {
    id: 'wp-opcache',
    category: 'performance',
    severity: 'medium',
    source: 'connector',
    evaluate: ({ performance }) => {
      if (performance.opcache === null) return unknown(NEEDS_AUDIT);
      return performance.opcache
        ? { status: 'pass', message: 'on' }
        : { status: 'fail', message: 'off', impact: { scoreGain: 6, timeSavedMs: 250 } };
    },
  },
  {
    id: 'wp-memory-limit',
    category: 'performance',
    severity: 'low',
    source: 'connector',
    evaluate: ({ performance }) => {
      const bytes = performance.memoryLimitBytes;
      if (bytes === null) return unknown(NEEDS_AUDIT);
      if (bytes === -1) return { status: 'pass', message: 'unlimited' };
      const observed = formatBytes(bytes);
      return bytes < 128 * MB
        ? { status: 'warn', message: 'low', values: { size: observed }, observed, impact: { scoreGain: 2 } }
        : { status: 'pass', message: 'ok', values: { size: observed }, observed };
    },
  },

  // ---------- red flags ----------
  {
    id: 'red-flag-uploads-php',
    category: 'red-flags',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-review-uploads-php', automation: 'guided', risk: 'high', reversible: false },
    evaluate: ({ redFlags }) => {
      if (redFlags.uploadsPhpFiles === null) return unknown('unknown');
      return redFlags.uploadsPhpFiles > 0
        ? {
            status: 'fail',
            message: 'found', values: { count: redFlags.uploadsPhpFiles },
            observed: String(redFlags.uploadsPhpFiles),
            impact: { scoreGain: 12, riskReduction: 35 },
          }
        : { status: 'pass', message: 'none' };
    },
  },
];
