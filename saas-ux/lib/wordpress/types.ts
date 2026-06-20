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
  | 'flush_cache'
  | 'verify_render';

export interface WordPressVerificationResult {
  success: boolean;
  checkedAt: string;
  message?: string;
  screenshotUrl?: string;
  issues?: WordPressIssue[];
}

export interface WordPressPlannedAction {
  id: string;
  type: WordPressActionType;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  autoApplyEligible: boolean;
  requiresApproval: boolean;
  requiredCapabilities: string[];
  verification?: {
    kind: 'api' | 'visual' | 'content';
    expectation: string;
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
