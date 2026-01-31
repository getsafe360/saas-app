// components/reports/templates/PerformanceReport.tsx
// Complete Performance Optimization Report template for PDF generation

import type { PerformanceScorecardData } from '@/lib/db/schema/reports/performance-scorecard';
import type { BrandingConfig } from '@/lib/db/schema/reports/branding';
import { ReportHeader } from './ReportHeader';
import { ExecutiveSummary } from './ExecutiveSummary';
import { ScorecardBreakdown } from './ScorecardBreakdown';
import { BeforeAfterSection } from './BeforeAfterSection';
import { OptimizationsPerformed } from './OptimizationsPerformed';
import { ReportFooter } from './ReportFooter';

interface OptimizationItem {
  id: string;
  name: string;
  category: string;
  status: 'completed' | 'pending' | 'skipped';
  before?: string;
  after?: string;
  savings?: string;
  description?: string;
}

interface MetricComparison {
  label: string;
  before: string | number;
  after: string | number;
  unit?: string;
  improvement?: string;
}

interface PerformanceReportProps {
  // Site info
  siteName: string;
  siteUrl: string;
  generatedAt: Date;

  // Scores and metrics
  overallScore: number;
  overallGrade: string;
  scorecard?: PerformanceScorecardData;

  // Issues
  issuesFound: number;
  issuesFixed: number;

  // Savings
  estimatedSavings?: {
    loadTime?: string;
    bandwidth?: string;
    monthlyCost?: string;
  };

  // Before/After metrics
  metrics?: MetricComparison[];
  screenshotBefore?: string;
  screenshotAfter?: string;

  // Optimizations
  optimizations?: OptimizationItem[];

  // Branding
  branding?: {
    companyName: string;
    logoUrl?: string | null;
    config: BrandingConfig;
  };
}

export function PerformanceReport({
  siteName,
  siteUrl,
  generatedAt,
  overallScore,
  overallGrade,
  scorecard,
  issuesFound,
  issuesFixed,
  estimatedSavings,
  metrics,
  screenshotBefore,
  screenshotAfter,
  optimizations,
  branding,
}: PerformanceReportProps) {
  const primaryColor = branding?.config.colors.primary || '#2563eb';

  return (
    <div
      className="performance-report"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px',
        backgroundColor: '#ffffff',
        color: '#1f2937',
        lineHeight: 1.5,
      }}
    >
      {/* Header with branding */}
      <ReportHeader
        siteName={siteName}
        siteUrl={siteUrl}
        generatedAt={generatedAt}
        reportType="performance"
        branding={branding}
      />

      {/* Executive Summary */}
      <ExecutiveSummary
        overallScore={overallScore}
        overallGrade={overallGrade}
        issuesFound={issuesFound}
        issuesFixed={issuesFixed}
        estimatedSavings={estimatedSavings}
        primaryColor={primaryColor}
      />

      {/* Scorecard Breakdown (if available) */}
      {scorecard && (
        <ScorecardBreakdown scorecard={scorecard} primaryColor={primaryColor} />
      )}

      {/* Before/After Comparison */}
      {metrics && metrics.length > 0 && (
        <BeforeAfterSection
          metrics={metrics}
          screenshotBefore={screenshotBefore}
          screenshotAfter={screenshotAfter}
          primaryColor={primaryColor}
        />
      )}

      {/* Optimizations Performed */}
      {optimizations && (
        <OptimizationsPerformed
          optimizations={optimizations}
          primaryColor={primaryColor}
        />
      )}

      {/* Priority Actions (from scorecard) */}
      {scorecard?.priorityActions && scorecard.priorityActions.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              margin: '0 0 20px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#1f2937',
            }}
          >
            Recommended Next Steps
          </h2>
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {scorecard.priorityActions.map((action, index) => (
              <div
                key={action.priority}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  borderBottom:
                    index < scorecard.priorityActions.length - 1
                      ? '1px solid #e5e7eb'
                      : 'none',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: primaryColor,
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {action.priority}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1f2937',
                    }}
                  >
                    {action.action}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#6b7280',
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                      }}
                    >
                      {action.category}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor:
                          action.effort === 'low'
                            ? '#dcfce7'
                            : action.effort === 'medium'
                              ? '#fef3c7'
                              : '#fee2e2',
                        color:
                          action.effort === 'low'
                            ? '#166534'
                            : action.effort === 'medium'
                              ? '#92400e'
                              : '#991b1b',
                        borderRadius: '4px',
                      }}
                    >
                      {action.effort} effort
                    </span>
                    {(action.estimatedImpact.ms || action.estimatedImpact.kb) && (
                      <span style={{ color: '#10b981' }}>
                        Est. savings:{' '}
                        {action.estimatedImpact.ms && `${action.estimatedImpact.ms}ms`}
                        {action.estimatedImpact.ms && action.estimatedImpact.kb && ', '}
                        {action.estimatedImpact.kb && `${action.estimatedImpact.kb}KB`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <ReportFooter branding={branding} />
    </div>
  );
}
