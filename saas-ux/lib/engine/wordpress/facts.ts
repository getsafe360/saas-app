// lib/engine/wordpress/facts.ts
//
// Observed WordPress facts. Every field is `null` unless something actually
// observed it (connector snapshot, external probe, response headers). Rules
// map `null` to an `unknown` check instead of assuming a value.

export interface WordPressFacts {
  connected: boolean;
  /** When the connector snapshot was taken, if any. */
  observedAt: string | null;
  core: {
    version: string | null;
    latest: string | null;
    latestReleaseDate: string | null;
  };
  /** Protections switched on by the GetSafe 360 connector itself. */
  protections: {
    xmlrpcDisabled: boolean | null;
    userEnumerationBlocked: boolean | null;
  };
  security: {
    /** From an external probe of /xmlrpc.php; null when not probed. */
    xmlrpcReachable: boolean | null;
    loginProtected: boolean | null;
    debugMode: boolean | null;
  };
  plugins: {
    active: number | null;
    outdated: number | null;
    vulnerable: number | null;
  };
  performance: {
    objectCache: boolean | null;
    opcache: boolean | null;
    /** `content-encoding` of the page response; null when headers unavailable. */
    compression: string | null;
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

  return {
    connected: Boolean(apiData?.connectionStatus?.isConnected),
    observedAt: asString(snapshot.inspectedAt),
    core: {
      version: asString(snapshot.wpVersion) ?? asString(apiData?.cms?.wp?.version),
      latest: asString(telemetry.latestVersion),
      latestReleaseDate: asString(telemetry.latestReleaseDate),
    },
    protections: {
      xmlrpcDisabled: protections ? asBool(protections.disableXmlRpc) : null,
      userEnumerationBlocked: protections ? asBool(protections.blockUserEnumeration) : null,
    },
    security: {
      xmlrpcReachable: asBool(apiData?.cms?.wp?.xmlrpc),
      loginProtected: asBool(telemetry.security?.loginProtected),
      debugMode: asBool(telemetry.security?.wpDebugMode),
    },
    plugins: {
      active: hasSnapshot && Array.isArray(snapshot.activePlugins) ? snapshot.activePlugins.length : null,
      // Not reported by connector ≤1.4; the telemetry builder's zeros are placeholders, not observations.
      outdated: asNumber(telemetry.pluginHealth?.outdated),
      vulnerable: asNumber(telemetry.pluginHealth?.vulnerable),
    },
    performance: {
      objectCache: asBool(telemetry.performance?.objectCache),
      opcache: asBool(telemetry.performance?.opcacheEnabled),
      compression: encoding === undefined ? null : (encoding ?? 'identity'),
    },
    seo: {
      sitemapReachable: asBool(telemetry.seo?.sitemapReachable),
    },
  };
}
