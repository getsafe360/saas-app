/**
 * AI Crew API Client
 * Communicates with Python FastAPI microservice
 */

export interface AIAnalyzeRequest {
  url: string;
  modules: ('seo' | 'performance' | 'security' | 'accessibility' | 'content')[];
  siteId?: string;
  locale?: string;
}

export interface AIIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  autoFixable: boolean;
}

export interface AIFix {
  id: string;
  issueId: string;
  title: string;
  description: string;
  code?: string;
  implementation: 'automatic' | 'manual' | 'plugin' | 'wordpress_api';
  estimatedTime: string;
  impactScore: number;
}

export interface CategoryAnalysisResult {
  score: number;
  grade: string;
  issues: AIIssue[];
  fixes: AIFix[];
  metadata: Record<string, any>;
}

export interface AIAnalysisResponse {
  jobId: string;
  url: string;
  selectedModules: string[];
  results: Record<string, CategoryAnalysisResult>;
  timestamp: string;
  usageMetrics?: Record<string, any>;
}

export interface AIRepairIssue {
  id: string;
  category: 'seo' | 'performance' | 'security' | 'accessibility' | 'wordpress';
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface AIRepairRequest {
  siteId: string;
  issues: AIRepairIssue[];
  wordpress?: {
    connected: boolean;
    apiUrl?: string;
    authToken?: string;
  };
  dryRun?: boolean;
}

export interface AIRepairResult {
  issueId: string;
  success: boolean;
  method: string;
  changes: Array<{
    file?: string;
    action?: string;
    description?: string;
    before?: string;
    after?: string;
  }>;
  error?: string;
}

export interface AIRepairResponse {
  jobId: string;
  siteId: string;
  totalIssues: number;
  repaired: AIRepairResult[];
  failed: AIRepairResult[];
  timestamp: string;
}

/**
 * AI Crew Client Class
 */
export class AICrewClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.AI_CREW_API_URL || 'http://localhost:8000';
    this.apiKey = apiKey || process.env.AI_CREW_API_KEY || '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Analyze a website using AI agents
   */
  async analyze(request: AIAnalyzeRequest): Promise<AIAnalysisResponse> {
    return this.request<AIAnalysisResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Execute automated repairs
   */
  async repair(request: AIRepairRequest): Promise<AIRepairResponse> {
    return this.request<AIRepairResponse>('/repair', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    return this.request('/health', { method: 'GET' });
  }
}

/**
 * Default client instance
 */
export const aiCrewClient = new AICrewClient();

/**
 * Transform AI crew results to SiteCockpit format
 *
 * Maps the AI crew's CategoryAnalysisResult to the format expected by
 * individual dashboard cards (PerformanceCard, SEOCard, etc.)
 */
export function transformToSiteCockpitFormat(
  category: string,
  result: CategoryAnalysisResult
): any {
  const base = {
    score: result.score,
    grade: result.grade,
  };

  switch (category) {
    case 'seo':
      return {
        ...base,
        title: result.metadata.title || '',
        description: result.metadata.description || '',
        keywords: result.metadata.keywords || [],
        content: result.metadata.content || {},
        aiReadiness: result.metadata.aiReadiness || {},
        issues: result.issues.map(i => i.title),
      };

    case 'performance':
      return {
        ...base,
        metrics: result.metadata.metrics || {},
        recommendations: result.metadata.recommendations || [],
      };

    case 'security':
      return {
        ...base,
        https: result.metadata.https !== undefined ? result.metadata.https : true,
        certificate: result.metadata.certificate || {},
        headers: result.metadata.headers || {},
        vulnerabilities: {
          total: result.issues.filter(i => i.type === 'error').length,
          details: result.issues.map(i => i.title),
        },
      };

    case 'accessibility':
      return {
        ...base,
        wcagLevel: result.metadata.wcagLevel || 'AA',
        issues: result.issues.map(i => i.title),
        passedChecks: result.metadata.passedChecks || 0,
        categories: result.metadata.categories || {},
      };

    default:
      return base;
  }
}
