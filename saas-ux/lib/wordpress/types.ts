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

export interface WordPressConnectorSettingPayload {
  key: 'disableXmlRpc' | 'blockUserEnumeration';
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

export interface WordPressConnectorActionRequest {
  id: string;
  type: 'update_connector_setting';
  payload: WordPressConnectorSettingPayload;
}

export interface WordPressConnectorActionResult {
  id: string;
  type: WordPressConnectorActionRequest['type'];
  status: 'applied' | 'skipped' | 'failed';
  message: string;
  state?: WordPressConnectorProtectionState;
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
