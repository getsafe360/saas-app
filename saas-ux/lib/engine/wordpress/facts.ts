// lib/engine/wordpress/facts.ts
//
// Observed WordPress facts. Every field is `null` unless something actually
// observed it (connector snapshot, external probe, response headers). Rules
// map `null` to an `unknown` check instead of assuming a value.

import { parseWordPressAudit } from '@/lib/wordpress/audit-types';

export interface WordPressFacts {
  connected: boolean;
  /** When the connector snapshot was taken, if any. */
  observedAt: string | null;
  core: {
    version: string | null;
    latest: string | null;
    latestReleaseDate: string | null;
    /** From the site's own update check (audit); null when not known. */
    updateAvailable: boolean | null;
  };
  /** Protections switched on by the GetSafe 360 connector itself. */
  protections: {
    xmlrpcDisabled: boolean | null;
    userEnumerationBlocked: boolean | null;
  };
  security: {
    /** From an external probe of /xmlrpc.php; null when not probed. */
    xmlrpcReachable: boolean | null;
    /** XML-RPC as WordPress itself reports it (audit), after all filters. */
    xmlrpcEnabled: boolean | null;
    loginProtected: boolean | null;
    debugMode: boolean | null;
    debugDisplay: boolean | null;
    debugLog: boolean | null;
    adminCount: number | null;
    hasAdminUsername: boolean | null;
    /** Anyone can register and new accounts become administrators. */
    openAdminRegistration: boolean | null;
    fileEditDisabled: boolean | null;
    saltsConfigured: boolean | null;
    dbPrefixDefault: boolean | null;
    homeHttps: boolean | null;
    wpConfigWorldReadable: boolean | null;
  };
  plugins: {
    active: number | null;
    inactive: number | null;
    outdated: number | null;
    vulnerable: number | null;
  };
  themes: {
    inactive: number | null;
    activeUpdateAvailable: boolean | null;
  };
  performance: {
    objectCache: boolean | null;
    pageCache: boolean | null;
    opcache: boolean | null;
    /** `content-encoding` of the page response; null when headers unavailable. */
    compression: string | null;
    phpVersion: string | null;
    /** -1 = unlimited. */
    memoryLimitBytes: number | null;
  };
  database: {
    autoloadBytes: number | null;
    expiredTransients: number | null;
    revisions: number | null;
    /** Revisions beyond the newest 5 per post; null before connector 1.7. */
    revisionsRemovable: number | null;
  };
  /** Connector ≥ 1.7; every field null before. */
  autoUpdates: {
    updaterDisabled: boolean | null;
    coreMinor: boolean | null;
    pluginsAllowed: boolean | null;
    pluginsEnabled: number | null;
    pluginsTotal: number | null;
  };
  cron: {
    disabled: boolean | null;
    overdue: number | null;
  };
  redFlags: {
    uploadsPhpFiles: number | null;
    coreModifiedFiles: number | null;
  };
  seo: {
    sitemapReachable: boolean | null;
  };
}

type Loose = Record<string, any>;

const asBool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function headerValue(headers: unknown, name: string): string | null | undefined {
  if (!headers || typeof headers !== 'object') return undefined; // headers not captured
  const entry = Object.entries(headers as Loose).find(([key]) => key.toLowerCase() === name);
  if (!entry) return null; // headers captured, this one absent
  return asString(Array.isArray(entry[1]) ? entry[1].join(', ') : entry[1]);
}

/**
 * Build facts from the cockpit API payload (`analyze-facts` + connector
 * telemetry). Missing inputs stay `null`; nothing is defaulted.
 */
export function buildWordPressFacts(apiData: Loose): WordPressFacts {
  const telemetry: Loose = apiData?.wordpressTelemetry ?? {};
  const snapshot: Loose = telemetry.snapshot ?? {};
  const protections: Loose | undefined = snapshot.protections ?? telemetry.protections;
  const hasSnapshot = Boolean(telemetry.snapshot);
  const encoding = headerValue(apiData?.headers, 'content-encoding');
  // Connector ≥ 1.6 audit; every field below falls back to null without it.
  const audit = parseWordPressAudit(snapshot.audit);
  const sec: Loose = audit?.security ?? {};
  const perf: Loose = audit?.performance ?? {};

  const usersCanRegister = asBool(sec.usersCanRegister);
  const defaultRoleIsAdmin = asBool(sec.defaultRoleIsAdmin);

  return {
    connected: Boolean(apiData?.connectionStatus?.isConnected),
    observedAt: asString(snapshot.inspectedAt),
    core: {
      version: asString(audit?.core.version) ?? asString(snapshot.wpVersion) ?? asString(apiData?.cms?.wp?.version),
      latest: asString(telemetry.latestVersion),
      latestReleaseDate: asString(telemetry.latestReleaseDate),
      updateAvailable: asBool(audit?.core.updateAvailable),
    },
    protections: {
      xmlrpcDisabled: protections ? asBool(protections.disableXmlRpc) : null,
      userEnumerationBlocked: protections ? asBool(protections.blockUserEnumeration) : null,
    },
    security: {
      xmlrpcReachable: asBool(apiData?.cms?.wp?.xmlrpc),
      xmlrpcEnabled: asBool(sec.xmlrpcEnabled),
      loginProtected: asBool(telemetry.security?.loginProtected),
      debugMode: asBool(sec.debug) ?? asBool(telemetry.security?.wpDebugMode),
      debugDisplay: asBool(sec.debugDisplay),
      debugLog: asBool(sec.debugLog),
      adminCount: asNumber(sec.adminCount),
      hasAdminUsername: asBool(sec.hasAdminUsername),
      openAdminRegistration:
        usersCanRegister === null || defaultRoleIsAdmin === null ? null : usersCanRegister && defaultRoleIsAdmin,
      fileEditDisabled: asBool(sec.fileEditDisabled),
      saltsConfigured: asBool(sec.saltsConfigured),
      dbPrefixDefault: asBool(sec.dbPrefixDefault),
      homeHttps: asBool(sec.homeHttps),
      wpConfigWorldReadable: asBool(sec.wpConfigWorldReadable),
    },
    plugins: {
      active: audit
        ? asNumber(audit.plugins.active)
        : hasSnapshot && Array.isArray(snapshot.activePlugins) ? snapshot.activePlugins.length : null,
      inactive: asNumber(audit?.plugins.inactive),
      outdated: asNumber(audit?.plugins.updatesAvailable) ?? asNumber(telemetry.pluginHealth?.outdated),
      // Needs a vulnerability database; not observed yet.
      vulnerable: asNumber(telemetry.pluginHealth?.vulnerable),
    },
    themes: {
      inactive: asNumber(audit?.themes.inactive),
      activeUpdateAvailable: asBool(audit?.themes.activeUpdateAvailable),
    },
    performance: {
      objectCache: asBool(perf.objectCache) ?? asBool(telemetry.performance?.objectCache),
      pageCache: asBool(perf.pageCache),
      opcache: asBool(perf.opcache) ?? asBool(telemetry.performance?.opcacheEnabled),
      compression: encoding === undefined ? null : (encoding ?? 'identity'),
      phpVersion: asString(perf.phpVersion) ?? asString(snapshot.phpVersion),
      memoryLimitBytes: asNumber(perf.memoryLimitBytes),
    },
    database: {
      autoloadBytes: asNumber(audit?.database.autoloadBytes),
      expiredTransients: asNumber(audit?.database.expiredTransients),
      revisions: asNumber(audit?.database.revisions),
      revisionsRemovable: asNumber(audit?.database.revisionsRemovable),
    },
    autoUpdates: {
      updaterDisabled: asBool(audit?.autoUpdates?.updaterDisabled),
      coreMinor: asBool(audit?.autoUpdates?.coreMinor),
      pluginsAllowed: asBool(audit?.autoUpdates?.pluginsAllowed),
      pluginsEnabled: asNumber(audit?.autoUpdates?.pluginsEnabled),
      pluginsTotal: asNumber(audit?.autoUpdates?.pluginsTotal),
    },
    cron: {
      disabled: asBool(audit?.cron.disabled),
      overdue: asNumber(audit?.cron.overdue),
    },
    redFlags: {
      uploadsPhpFiles: asNumber(audit?.redFlags.uploadsPhpFiles),
      coreModifiedFiles: asNumber(audit?.redFlags.coreModifiedFiles),
    },
    seo: {
      sitemapReachable: asBool(telemetry.seo?.sitemapReachable),
    },
  };
}
