export interface AuditItem {
  finding: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  fix?: string;
}

export interface AnalysisResult {
  accessibility: AuditItem;
  performance: AuditItem;
  seo: AuditItem;
  security: AuditItem;
  content: AuditItem;
  wordpress?: {
    detected: boolean;
    version?: string;
    insights?: string;
    vulnerabilities?: AuditItem[];
  };
  summary: string;
  cta: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type Category = 'accessibility' | 'performance' | 'seo' | 'security' | 'content' | 'wordpress';
