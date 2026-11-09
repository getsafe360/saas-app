// lib/engine/wordpress/rules.ts
//
// WordPress health rule pack. Check ids and fixer ids are unchanged from the
// previous healthEngine so stored action runs and the remediate route keep
// matching. Inputs the connector does not report yet resolve to `unknown`.

import type { CategoryWeights } from '../scoring';
import { type Rule, unknown } from '../rules';
import { WORDPRESS_AUDIT_RULES } from './audit-rules';
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

const NOT_REPORTED = 'common.notReported';

export const WORDPRESS_RULES: ReadonlyArray<Rule<WordPressFacts>> = [
  {
    id: 'wp-core-version',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-update-core', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ core }) => {
      if (core.version && !core.latest && core.updateAvailable !== null) {
        // Fall back to the site's own update check when wordpress.org could not be reached.
        return core.updateAvailable
          ? {
              status: 'fail',
              message: 'updateAvailable', values: { version: core.version },
              observed: core.version,
              impact: { scoreGain: 8, riskReduction: 28 },
            }
          : { status: 'pass', message: 'current', values: { version: core.version }, observed: core.version };
      }
      if (!core.version || !core.latest) return unknown('unknown');
      if (compareVersions(core.version, core.latest) < 0) {
        return {
          status: 'fail',
          message: 'outdated', values: { version: core.version, latest: core.latest },
          observed: core.version,
          impact: { scoreGain: 8, riskReduction: 28 },
        };
      }
      return { status: 'pass', message: 'current', values: { version: core.version }, observed: core.version };
    },
  },
  {
    id: 'wp-login-exposed',
    category: 'security',
    severity: 'medium',
    source: 'external-probe',
    fix: { fixerId: 'wordpress-harden-login', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) => {
      if (security.loginProtected === null) return unknown('unknown');
      return security.loginProtected
        ? { status: 'pass', message: 'protected' }
        : {
            status: 'fail',
            message: 'exposed',
            impact: { scoreGain: 6, riskReduction: 20 },
          };
    },
  },
  {
    id: 'wp-user-enumeration',
    category: 'security',
    severity: 'high',
    source: 'connector',
    fix: {
      fixerId: 'wordpress-block-user-enumeration',
      automation: 'auto',
      risk: 'low',
      reversible: true,
      requiresCapabilities: ['securityBlockUserEnumeration'],
    },
    evaluate: ({ protections }) => {
      if (protections.userEnumerationBlocked === null) return unknown('unknown');
      return protections.userEnumerationBlocked
        ? { status: 'pass', message: 'blocked' }
        : {
            status: 'warn',
            confidence: 'medium',
            message: 'exposed',
            impact: { scoreGain: 7, riskReduction: 18 },
          };
    },
  },
  {
    id: 'wp-xmlrpc',
    category: 'security',
    severity: 'medium',
    source: 'connector',
    fix: {
      fixerId: 'wordpress-disable-xmlrpc',
      automation: 'auto',
      risk: 'low',
      reversible: true,
      requiresCapabilities: ['securityDisableXmlrpc'],
    },
    evaluate: ({ protections, security }) => {
      if (protections.xmlrpcDisabled === true) {
        return { status: 'pass', message: 'disabledByUs' };
      }
      if (security.xmlrpcEnabled === false) {
        return { status: 'pass', message: 'turnedOff' };
      }
      if (security.xmlrpcReachable === false) {
        return { status: 'pass', message: 'notReachable', source: 'external-probe' };
      }
      if (security.xmlrpcReachable === true) {
        return {
          status: 'fail',
          message: 'reachable',
          source: 'external-probe',
          impact: { scoreGain: 6, riskReduction: 16 },
        };
      }
      if (security.xmlrpcEnabled === true) {
        return {
          status: 'fail',
          message: 'enabled',
          impact: { scoreGain: 6, riskReduction: 16 },
        };
      }
      if (protections.xmlrpcDisabled === false) {
        return {
          status: 'warn',
          confidence: 'medium',
          message: 'defaultOn',
          impact: { scoreGain: 6, riskReduction: 16 },
        };
      }
      return unknown('unknown');
    },
  },
  {
    id: 'wp-debug-mode',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-disable-debug', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ security }) => {
      if (security.debugDisplay === true) {
        return {
          status: 'fail',
          severity: 'high',
          message: 'display',
          impact: { scoreGain: 6, riskReduction: 14 },
        };
      }
      if (security.debugMode === null) return unknown(NOT_REPORTED);
      return security.debugMode
        ? {
            status: 'warn',
            message: 'on',
            impact: { scoreGain: 3, riskReduction: 6 },
          }
        : { status: 'pass', message: 'off' };
    },
  },
  {
    id: 'wp-vulnerable-plugins',
    category: 'security',
    severity: 'critical',
    source: 'connector',
    fix: { fixerId: 'wordpress-remediate-vulnerable-plugins', automation: 'guided', risk: 'high', reversible: false },
    evaluate: ({ plugins }) => {
      if (plugins.vulnerable === null) return unknown(NOT_REPORTED);
      return plugins.vulnerable > 0
        ? {
            status: 'fail',
            message: 'found', values: { count: plugins.vulnerable },
            observed: String(plugins.vulnerable),
            impact: { scoreGain: 12, riskReduction: 35 },
          }
        : { status: 'pass', message: 'none', severity: 'low' };
    },
  },
  {
    id: 'wp-outdated-plugins',
    category: 'stability',
    severity: 'medium',
    source: 'connector',
    // Updates can break a site: never ticked in advance (medium), undone from a restore point.
    fix: { fixerId: 'wordpress-update-plugins', automation: 'auto', risk: 'medium', reversible: true },
    evaluate: ({ plugins }) => {
      if (plugins.outdated === null) return unknown(NOT_REPORTED);
      if (plugins.outdated === 0) return { status: 'pass', message: 'upToDate' };
      return {
        // Without direct file access (FTP credentials, DISALLOW_FILE_MODS, multisite) the dashboard is the way.
        ...(plugins.updatesPossible === false ? { fix: null } : {}),
        status: 'fail',
        severity: plugins.outdated > 4 ? 'high' : 'medium',
        message: 'outdated', values: { count: plugins.outdated },
        observed: String(plugins.outdated),
        impact: { scoreGain: 7, riskReduction: 15 },
      };
    },
  },
  {
    id: 'wp-object-cache',
    category: 'performance',
    severity: 'medium',
    source: 'connector',
    fix: { fixerId: 'wordpress-enable-object-cache', automation: 'guided', risk: 'medium', reversible: false },
    evaluate: ({ performance }) => {
      if (performance.objectCache === null) return unknown(NOT_REPORTED);
      return performance.objectCache
        ? { status: 'pass', message: 'enabled' }
        : {
            status: 'fail',
            message: 'missing',
            impact: { scoreGain: 9, timeSavedMs: 700 },
          };
    },
  },
  {
    id: 'wp-gzip',
    category: 'performance',
    severity: 'medium',
    source: 'external-probe',
    fix: { fixerId: 'wordpress-enable-compression', automation: 'guided', risk: 'low', reversible: false },
    evaluate: ({ performance }) => {
      if (performance.compression === null) return unknown('common.headersNotCaptured');
      const encoding = performance.compression.toLowerCase();
      if (encoding.includes('br') || encoding.includes('gzip') || encoding.includes('zstd')) {
        return { status: 'pass', message: 'compressed', values: { encoding }, observed: encoding };
      }
      return {
        status: 'fail',
        message: 'uncompressed',
        observed: encoding,
        impact: { scoreGain: 6, timeSavedMs: 450 },
      };
    },
  },
  {
    id: 'seo-sitemap',
    category: 'seo',
    severity: 'medium',
    source: 'external-probe',
    fix: { fixerId: 'wordpress-fix-sitemap', automation: 'manual', risk: 'low', reversible: false },
    evaluate: ({ seo }) => {
      if (seo.sitemapReachable === null) return unknown('unknown');
      return seo.sitemapReachable
        ? { status: 'pass', message: 'reachable' }
        : { status: 'fail', message: 'missing', impact: { scoreGain: 3, riskReduction: 4 } };
    },
  },
  {
    id: 'red-flag-hidden-plugins',
    category: 'red-flags',
    severity: 'high',
    source: 'connector',
    fix: { fixerId: 'wordpress-audit-plugins-integrity', automation: 'manual', risk: 'high', reversible: false },
    evaluate: () => unknown('unknown'),
  },
  {
    id: 'red-flag-core-modifications',
    category: 'red-flags',
    severity: 'critical',
    source: 'connector',
    fix: { fixerId: 'wordpress-run-integrity-scan', automation: 'guided', risk: 'high', reversible: false },
    evaluate: ({ redFlags }) => {
      if (redFlags.coreModifiedFiles === null) return unknown('unknown');
      return redFlags.coreModifiedFiles > 0
        ? {
            status: 'fail',
            message: 'modified', values: { count: redFlags.coreModifiedFiles },
            observed: String(redFlags.coreModifiedFiles),
            impact: { scoreGain: 15, riskReduction: 40 },
          }
        : { status: 'pass', message: 'clean' };
    },
  },
  ...WORDPRESS_AUDIT_RULES,
];
