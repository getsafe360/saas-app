import type { WordPressAuditResponse } from './audit-types';
export type WordPressBuilder =
  | 'divi'
  | 'elementor'
  | 'gutenberg'
  | 'bricks'
  | 'beaver'
  | 'oxygen'
  | 'unknown';

export type WordPressSeoPlugin =
  | 'yoast'
  | 'rankmath'
  | 'aioseo'
  | 'seopress'
  | 'none'
  | 'unknown';

export type WordPressIssueCategory =
  | 'branding'
  | 'content'
  | 'media'
  | 'seo'
  | 'layout'
  | 'technical';

export type WordPressIssueSeverity = 'low' | 'medium' | 'high';

export interface WordPressThemeInfo {
  name?: string;
  stylesheet: string;
  template: string;
  hasChildTheme: boolean | null;
}

export interface WordPressFrontPageInfo {
  pageId?: number;
  title?: string;
  slug?: string;
}

export interface WordPressIssue {
  id: string;
  category: WordPressIssueCategory;
  severity: WordPressIssueSeverity;
  title: string;
  detail: string;
}

export interface WordPressCapabilitySummary {
  read: boolean;
  write: boolean;
  themeFiles: boolean;
  mediaUpload: boolean;
  pageUpdate: boolean;
  rollback: boolean;
  raw: Record<string, boolean>;
}

export interface WordPressConnectorProtectionState {
  disableXmlRpc: boolean;
  blockUserEnumeration: boolean;
  /** Connector ≥ 1.7. */
  disableFileEditor?: boolean;
  /** Connector ≥ 1.7. */
  enableCoreSecurityUpdates?: boolean;
}

export interface WordPressSiteSnapshot {
  siteUrl: string;
  inspectedAt: string;
  wpVersion?: string;
  pluginVersion?: string;
  phpVersion?: string;
  mysqlVersion?: string;
  activeTheme: WordPressThemeInfo;
  builder: WordPressBuilder;
  seoPlugin: WordPressSeoPlugin;
  activePlugins: string[];
  frontPage?: WordPressFrontPageInfo;
  capabilities: WordPressCapabilitySummary;
  /** Protections switched on by the GetSafe 360 connector; absent before 1.4. */
  protections?: WordPressConnectorProtectionState;
  /** Read-only site audit (connector ≥ 1.6, capability `siteAudit`). */
  audit?: WordPressAuditResponse;
  /** Health score computed when this snapshot was taken; feeds trends. */
  health?: {
    overall: number | null;
    coverage: number;
    categories: Partial<Record<string, number | null>>;
    /** Failing and warning checks at that time (for client reports); absent on older snapshots. */
    problems?: Array<{ id: string; severity: 'critical' | 'high' | 'medium' | 'low' }>;
  };
  issues: WordPressIssue[];
}

export type WordPressActionType =
  | 'create_child_theme'
  | 'upload_brand_assets'
  | 'activate_theme'
  | 'update_page_content'
  | 'create_page'
  | 'set_front_page'
  | 'update_theme_css'
  | 'update_theme_php'
  | 'create_menu'
  | 'assign_menu'
  | 'fix_broken_images'
  | 'apply_schema'
  | 'update_connector_setting'
  | 'set_security_headers'
  | 'set_config_permissions'
  | 'set_default_role'
  | 'set_plugin_auto_updates'
  | 'cleanup_database'
  | 'update_plugins'
  | 'restore_plugins'
  | 'restore_core_files'
  | 'quarantine_core_files'
  | 'restore_core_backup'
  | 'set_llms_txt'
  | 'set_ai_crawler_rules'
  | 'set_schema'
  | 'set_seo_meta'
  | 'flush_cache'
  | 'verify_render';

export type WordPressActionRisk = 'low' | 'medium' | 'high';
export type WordPressVerificationKind = 'api' | 'visual' | 'content' | 'mixed';
export type WordPressActionStatus = 'planned' | 'applied' | 'skipped' | 'failed';

export interface WordPressVerificationResult {
  success: boolean;
  checkedAt: string;
  message?: string;
  screenshotUrl?: string;
  issues?: WordPressIssue[];
}

export interface WordPressVerificationCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface WordPressDetailedVerificationResult extends WordPressVerificationResult {
  checks: WordPressVerificationCheck[];
}

export const CONNECTOR_SETTING_KEYS = [
  'disableXmlRpc',
  'blockUserEnumeration',
  'disableFileEditor',
  'enableCoreSecurityUpdates',
] as const;

export interface WordPressConnectorSettingPayload {
  key: (typeof CONNECTOR_SETTING_KEYS)[number];
  enabled: boolean;
}

export interface WordPressPlannedAction {
  id: string;
  type: WordPressActionType;
  title: string;
  description: string;
  risk: WordPressActionRisk;
  autoApplyEligible: boolean;
  requiresApproval: boolean;
  requiredCapabilities: string[];
  verification?: {
    kind: WordPressVerificationKind;
    expectation: string;
    assertions?: string[];
  };
  payload: Record<string, unknown>;
}

export interface WordPressActionPlan {
  siteId: string;
  source: 'ai' | 'system' | 'mixed';
  objective: string;
  builder: WordPressBuilder;
  actions: WordPressPlannedAction[];
}

/** Header name → value; null removes it. `replace` swaps the whole set (rollback). */
export interface WordPressSecurityHeadersPayload {
  headers: Record<string, string | null>;
  replace?: boolean;
}

/** `tighten` drops the "others" bits; an octal string (rollback) restores a previous mode. */
export interface WordPressConfigPermissionsPayload {
  mode: 'tighten' | string;
}

/** Only roles without administrative or editor capabilities are accepted by the connector. */
export interface WordPressDefaultRolePayload {
  role: string;
}

/** `enable: 'all'` turns on every plugin; `plugins` + `replace` restores an exact list (rollback). */
export type WordPressPluginAutoUpdatesPayload =
  | { enable: 'all' }
  | { plugins: string[]; replace: true };

export interface WordPressCleanupPayload {
  task: 'expired_transients' | 'revisions';
}

/** `'outdated'` updates every plugin with an installable update (the connector itself excluded). */
export interface WordPressUpdatePluginsPayload {
  plugins: 'outdated' | string[];
}

/** Restore point ids (32 hex characters) returned by an update_plugins run. */
export interface WordPressRestorePluginsPayload {
  restorePoints: string[];
}

/** `'modified'` restores every modified core file; `'unexpected'` quarantines every unexpected one. */
export interface WordPressCoreFilesPayload {
  paths: 'modified' | 'unexpected' | string[];
}

export interface WordPressCoreBackupPayload {
  restorePoint: string;
}

/** Connector 1.12: the llms.txt served at the site root; null removes it. */
export interface WordPressLlmsTxtPayload {
  content: string | null;
}

/** Connector 1.12: per AI crawler rules in the virtual robots.txt; null removes the connector's rule. */
export interface WordPressAiCrawlerRulesPayload {
  rules: Record<string, 'allow' | 'block' | null>;
}

/** Connector 1.12: home-page schema; an empty `types` list removes it. */
export interface WordPressSchemaPayload {
  types: Array<'Organization' | 'WebSite'>;
  sameAs?: string[];
}

/**
 * Connector 1.12: a page's title and description, written into Yoast or Rank
 * Math when active. null removes a value; `restore` (undo) lifts the length limits.
 */
export interface WordPressSeoMetaPayload {
  postId?: number;
  path?: string;
  title?: string | null;
  description?: string | null;
  restore?: boolean;
}

/** What /pull and /capabilities report about SEO (connector 1.12). */
export interface WordPressSeoEnvironment {
  seoPlugin: 'yoast' | 'rank-math' | 'aioseo' | 'seopress' | null;
  rootInstall: boolean;
  robotsFile: boolean;
  llmsFile: boolean;
  searchVisible: boolean;
  staticHomePage: boolean;
  llmsTxt: boolean;
  aiCrawlerRules: Record<string, 'allow' | 'block'>;
  schemaTypes: string[];
}

export type WordPressConnectorActionRequest =
  | { id: string; type: 'update_connector_setting'; payload: WordPressConnectorSettingPayload }
  | { id: string; type: 'set_security_headers'; payload: WordPressSecurityHeadersPayload }
  | { id: string; type: 'set_config_permissions'; payload: WordPressConfigPermissionsPayload }
  | { id: string; type: 'set_default_role'; payload: WordPressDefaultRolePayload }
  | { id: string; type: 'set_plugin_auto_updates'; payload: WordPressPluginAutoUpdatesPayload }
  | { id: string; type: 'cleanup_database'; payload: WordPressCleanupPayload }
  | { id: string; type: 'update_plugins'; payload: WordPressUpdatePluginsPayload }
  | { id: string; type: 'restore_plugins'; payload: WordPressRestorePluginsPayload }
  | { id: string; type: 'restore_core_files'; payload: WordPressCoreFilesPayload }
  | { id: string; type: 'quarantine_core_files'; payload: WordPressCoreFilesPayload }
  | { id: string; type: 'restore_core_backup'; payload: WordPressCoreBackupPayload }
  | { id: string; type: 'set_llms_txt'; payload: WordPressLlmsTxtPayload }
  | { id: string; type: 'set_ai_crawler_rules'; payload: WordPressAiCrawlerRulesPayload }
  | { id: string; type: 'set_schema'; payload: WordPressSchemaPayload }
  | { id: string; type: 'set_seo_meta'; payload: WordPressSeoMetaPayload };

export interface WordPressConnectorActionResult {
  id: string;
  type: WordPressConnectorActionRequest['type'];
  status: 'applied' | 'skipped' | 'failed';
  message: string;
  state?: WordPressConnectorProtectionState | Record<string, unknown> | null;
  rollback?: WordPressConnectorActionRequest | null;
}

export interface WordPressActionExecutionResult {
  actionId: string;
  type: WordPressActionType;
  title: string;
  status: WordPressActionStatus;
  applied: boolean;
  autoApplied: boolean;
  message: string;
  requiresApproval: boolean;
  verification?: WordPressDetailedVerificationResult;
  rollback?: WordPressConnectorActionRequest | null;
  connectorResult?: WordPressConnectorActionResult | null;
}
