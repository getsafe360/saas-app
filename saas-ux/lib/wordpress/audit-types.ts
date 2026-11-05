// lib/wordpress/audit-types.ts
//
// Response of the connector's read-only GET /audit route (plugin ≥ 1.6.0,
// schema 1). Flags and counts only. `null` means the plugin could not observe
// the value (e.g. update data not fetched yet, a file scan ran out of time).

export interface WordPressAuditResponse {
  success: boolean;
  schema: number;
  generatedAt: string;
  durationMs?: number;
  core: {
    version: string;
    updateAvailable: boolean | null;
  };
  security: {
    adminCount: number | null;
    hasAdminUsername: boolean;
    usersCanRegister: boolean;
    defaultRoleIsAdmin: boolean;
    fileEditDisabled: boolean;
    debug: boolean;
    debugDisplay: boolean;
    debugLog: boolean;
    saltsConfigured: boolean;
    dbPrefixDefault: boolean;
    xmlrpcEnabled: boolean;
    homeHttps: boolean;
    adminHttps: boolean;
    wpConfigWorldReadable: boolean | null;
  };
  plugins: {
    total: number;
    active: number;
    inactive: number;
    updatesAvailable: number | null;
    mustUse: number;
    items: Array<{ slug: string; version: string; active: boolean; updateAvailable: boolean | null }>;
  };
  themes: {
    total: number;
    inactive: number;
    childTheme: boolean;
    activeUpdateAvailable: boolean | null;
  };
  performance: {
    phpVersion: string;
    mysqlVersion: string;
    /** -1 means no limit. */
    memoryLimitBytes: number;
    maxExecutionTime: number;
    opcache: boolean | null;
    objectCache: boolean;
    pageCache: boolean;
  };
  database: {
    autoloadBytes: number | null;
    expiredTransients: number | null;
    revisions: number | null;
    sizeBytes: number | null;
  };
  cron: {
    disabled: boolean;
    alternate: boolean;
    events: number;
    overdue: number;
  };
  redFlags: {
    uploadsPhpFiles: number | null;
    coreModifiedFiles: number | null;
    scannedAt: string;
  };
  environment: {
    multisite: boolean;
    woocommerce: boolean;
    multilingual: 'wpml' | 'polylang' | 'translatepress' | null;
    locale: string;
  };
}

/** Accept only a well-formed schema-1 audit; anything else is treated as absent. */
export function parseWordPressAudit(raw: unknown): WordPressAuditResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const audit = raw as Partial<WordPressAuditResponse>;
  if (audit.schema !== 1) return null;
  for (const section of ['core', 'security', 'plugins', 'themes', 'performance', 'database', 'cron', 'redFlags'] as const) {
    if (!audit[section] || typeof audit[section] !== 'object') return null;
  }
  return audit as WordPressAuditResponse;
}
