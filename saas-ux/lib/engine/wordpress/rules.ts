// lib/engine/wordpress/rules.ts
//
// WordPress health rule pack. Check ids and fixer ids are unchanged from the
// previous healthEngine so stored action runs and the remediate route keep
// matching. Inputs the connector does not report yet resolve to `unknown`.

import type { CategoryWeights } from '../scoring';
import { type Rule, unknown } from '../rules';
import type { WordPressFacts } from './facts';

export const WORDPRESS_CATEGORY_WEIGHTS: CategoryWeights = {
  security: 0.35,
  performance: 0.2,
  stability: 0.2,
  seo: 0.1,
  accessibility: 0.05,
  'red-flags': 0.1,
};

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

const NOT_REPORTED = 'Not reported by the connector yet.';

export const WORDPRESS_RULES: ReadonlyArray<Rule<WordPressFacts>> = [
  {
    id: 'wp-core-version',
    category: 'security',
    title: 'WordPress core version',
    severity: 'high',
    source: 'connector',
    recommendation: 'Update WordPress core to the latest stable version.',
    fix: { fixerId: 'wordpress-update-core', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ core }) => {
      if (!core.version || !core.latest) return unknown('Core version could not be determined.');
      if (compareVersions(core.version, core.latest) < 0) {
        return {
          status: 'fail',
          summary: `Running ${core.version}; latest is ${core.latest}.`,
          observed: core.version,
          impact: { scoreGain: 8, riskReduction: 28 },
        };
      }
      return { status: 'pass', summary: `Running the latest version (${core.version}).`, observed: core.version };
    },
  },
  {
    id: 'wp-login-exposed',
    category: 'security',
    title: 'Login page protection',
    severity: 'medium',
    source: 'external-probe',
    recommendation: 'Restrict /wp-login.php and add rate limiting + CAPTCHA.',
    fix: { fixerId: 'wordpress-harden-login', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) => {
      if (security.loginProtected === null) return unknown('Login protection has not been probed yet.');
      return security.loginProtected
        ? { status: 'pass', summary: 'Login endpoint is rate-limited or protected.' }
        : {
            status: 'fail',
            summary: 'Default login endpoint is reachable without protection.',
            impact: { scoreGain: 6, riskReduction: 20 },
          };
    },
  },
  {
    id: 'wp-user-enumeration',
    category: 'security',
    title: 'User enumeration',
    severity: 'high',
    source: 'connector',
    recommendation: 'Block author archives and REST username listing for anonymous visitors.',
    fix: {
      fixerId: 'wordpress-block-user-enumeration',
      automation: 'auto',
      risk: 'low',
      reversible: true,
      requiresCapabilities: ['securityBlockUserEnumeration'],
    },
    evaluate: ({ protections }) => {
      if (protections.userEnumerationBlocked === null) return unknown('Connector protection state is unavailable.');
      return protections.userEnumerationBlocked
        ? { status: 'pass', summary: 'Username enumeration is blocked by GetSafe 360.' }
        : {
            status: 'warn',
            confidence: 'medium',
            summary: 'WordPress lists usernames publicly by default, and GetSafe 360 protection is off.',
            impact: { scoreGain: 7, riskReduction: 18 },
          };
    },
  },
  {
    id: 'wp-xmlrpc',
    category: 'security',
    title: 'XML-RPC exposure',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Disable XML-RPC unless an app or service explicitly needs it.',
    fix: {
      fixerId: 'wordpress-disable-xmlrpc',
      automation: 'auto',
      risk: 'low',
      reversible: true,
      requiresCapabilities: ['securityDisableXmlrpc'],
    },
    evaluate: ({ protections, security }) => {
      if (protections.xmlrpcDisabled === true) {
        return { status: 'pass', summary: 'XML-RPC is disabled by GetSafe 360.' };
      }
      if (security.xmlrpcReachable === false) {
        return { status: 'pass', summary: 'XML-RPC endpoint is not reachable.', source: 'external-probe' };
      }
      if (security.xmlrpcReachable === true) {
        return {
          status: 'fail',
          summary: 'XML-RPC endpoint responds to public requests.',
          source: 'external-probe',
          impact: { scoreGain: 6, riskReduction: 16 },
        };
      }
      if (protections.xmlrpcDisabled === false) {
        return {
          status: 'warn',
          confidence: 'medium',
          summary: 'WordPress enables XML-RPC by default, and GetSafe 360 protection is off.',
          impact: { scoreGain: 6, riskReduction: 16 },
        };
      }
      return unknown('XML-RPC state could not be determined.');
    },
  },
  {
    id: 'wp-debug-mode',
    category: 'stability',
    title: 'WP debug mode',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Set WP_DEBUG and WP_DEBUG_LOG to false on production.',
    fix: { fixerId: 'wordpress-disable-debug', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) => {
      if (security.debugMode === null) return unknown(NOT_REPORTED);
      return security.debugMode
        ? { status: 'fail', summary: 'Debug mode is enabled on a live site.', impact: { scoreGain: 4, riskReduction: 10 } }
        : { status: 'pass', summary: 'Debug mode is off.' };
    },
  },
  {
    id: 'wp-vulnerable-plugins',
    category: 'security',
    title: 'Known vulnerable plugins',
    severity: 'critical',
    source: 'connector',
    recommendation: 'Patch, replace, or remove vulnerable plugins immediately.',
    fix: { fixerId: 'wordpress-remediate-vulnerable-plugins', automation: 'guided', risk: 'high', reversible: false },
    evaluate: ({ plugins }) => {
      if (plugins.vulnerable === null) return unknown(NOT_REPORTED);
      return plugins.vulnerable > 0
        ? {
            status: 'fail',
            summary: `${plugins.vulnerable} plugin(s) with known vulnerabilities.`,
            observed: String(plugins.vulnerable),
            impact: { scoreGain: 12, riskReduction: 35 },
          }
        : { status: 'pass', summary: 'No plugins with known vulnerabilities.', severity: 'low' };
    },
  },
  {
    id: 'wp-outdated-plugins',
    category: 'stability',
    title: 'Outdated plugins',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Update plugins in batches and verify compatibility.',
    fix: { fixerId: 'wordpress-update-plugins', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ plugins }) => {
      if (plugins.outdated === null) return unknown(NOT_REPORTED);
      if (plugins.outdated === 0) return { status: 'pass', summary: 'All plugins are up to date.' };
      return {
        status: 'fail',
        severity: plugins.outdated > 4 ? 'high' : 'medium',
        summary: `${plugins.outdated} plugin(s) have updates available.`,
        observed: String(plugins.outdated),
        impact: { scoreGain: 7, riskReduction: 15 },
      };
    },
  },
  {
    id: 'wp-object-cache',
    category: 'performance',
    title: 'Object cache',
    severity: 'medium',
    source: 'connector',
    recommendation: 'Enable a persistent object cache (Redis or Memcached).',
    fix: { fixerId: 'wordpress-enable-object-cache', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ performance }) => {
      if (performance.objectCache === null) return unknown(NOT_REPORTED);
      return performance.objectCache
        ? { status: 'pass', summary: 'Persistent object cache is enabled.' }
        : {
            status: 'fail',
            summary: 'No persistent object cache.',
            impact: { scoreGain: 9, timeSavedMs: 700 },
          };
    },
  },
  {
    id: 'wp-gzip',
    category: 'performance',
    title: 'Compression',
    severity: 'medium',
    source: 'external-probe',
    recommendation: 'Enable Brotli or gzip compression at the server or CDN.',
    fix: { fixerId: 'wordpress-enable-compression', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ performance }) => {
      if (performance.compression === null) return unknown('Response headers were not captured.');
      const encoding = performance.compression.toLowerCase();
      if (encoding.includes('br') || encoding.includes('gzip') || encoding.includes('zstd')) {
        return { status: 'pass', summary: `Responses are compressed (${encoding}).`, observed: encoding };
      }
      return {
        status: 'fail',
        summary: 'HTML responses are not compressed.',
        observed: encoding,
        impact: { scoreGain: 6, timeSavedMs: 450 },
      };
    },
  },
  {
    id: 'seo-sitemap',
    category: 'seo',
    title: 'Sitemap availability',
    severity: 'medium',
    source: 'external-probe',
    recommendation: 'Make /sitemap.xml reachable and list it in robots.txt.',
    fix: { fixerId: 'wordpress-fix-sitemap', automation: 'manual', risk: 'low', reversible: false },
    evaluate: ({ seo }) => {
      if (seo.sitemapReachable === null) return unknown('Sitemap has not been probed yet.');
      return seo.sitemapReachable
        ? { status: 'pass', summary: 'Sitemap is reachable.' }
        : { status: 'fail', summary: 'No reachable sitemap found.', impact: { scoreGain: 3, riskReduction: 4 } };
    },
  },
  {
    id: 'red-flag-hidden-plugins',
    category: 'red-flags',
    title: 'Hidden plugin behavior',
    severity: 'high',
    source: 'connector',
    recommendation: 'Cross-check database plugin rows against the admin plugin list.',
    fix: { fixerId: 'wordpress-audit-plugins-integrity', automation: 'manual', risk: 'high', reversible: false },
    evaluate: () => unknown('Plugin integrity checks require connector telemetry v2.'),
  },
  {
    id: 'red-flag-core-modifications',
    category: 'red-flags',
    title: 'Modified core files',
    severity: 'critical',
    source: 'connector',
    recommendation: 'Compare wp-admin and wp-includes against the official WordPress checksums.',
    fix: { fixerId: 'wordpress-run-integrity-scan', automation: 'guided', risk: 'high', reversible: false },
    evaluate: () => unknown('Core checksum verification requires connector telemetry v2.'),
  },
];
