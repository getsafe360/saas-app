// components/reports/templates/ExecutiveSummary.tsx
// Executive summary section for PDF reports

interface ExecutiveSummaryProps {
  overallScore: number;
  overallGrade: string;
  issuesFound: number;
  issuesFixed: number;
  estimatedSavings?: {
    loadTime?: string;
    bandwidth?: string;
    monthlyCost?: string;
  };
  primaryColor?: string;
}

export function ExecutiveSummary({
  overallScore,
  overallGrade,
  issuesFound,
  issuesFixed,
  estimatedSavings,
  primaryColor = '#2563eb',
}: ExecutiveSummaryProps) {
  // Determine score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10b981'; // Green
    if (score >= 70) return '#f59e0b'; // Yellow
    if (score >= 50) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const scoreColor = getScoreColor(overallScore);

  return (
    <div
      className="executive-summary"
      style={{
        marginBottom: '32px',
        padding: '24px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f2937',
        }}
      >
        Executive Summary
      </h2>

      {/* Score Cards Row */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        {/* Overall Score */}
        <div
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: scoreColor,
              lineHeight: 1,
            }}
          >
            {overallScore}
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: scoreColor,
              marginTop: '4px',
            }}
          >
            {overallGrade}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
            Overall Score
          </div>
        </div>

        {/* Issues Found */}
        <div
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: issuesFound > 0 ? '#f59e0b' : '#10b981',
              lineHeight: 1,
            }}
          >
            {issuesFound}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
            Issues Identified
          </div>
        </div>

        {/* Issues Fixed */}
        <div
          style={{
            flex: '1',
            minWidth: '150px',
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#10b981',
              lineHeight: 1,
            }}
          >
            {issuesFixed}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
            Issues Resolved
          </div>
        </div>
      </div>

      {/* Estimated Savings */}
      {estimatedSavings && (
        <div
          style={{
            padding: '16px',
            backgroundColor: `${primaryColor}10`,
            borderRadius: '8px',
            border: `1px solid ${primaryColor}30`,
          }}
        >
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: primaryColor,
            }}
          >
            Estimated Savings
          </h3>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {estimatedSavings.loadTime && (
              <div>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
                  {estimatedSavings.loadTime}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                  faster load time
                </span>
              </div>
            )}
            {estimatedSavings.bandwidth && (
              <div>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
                  {estimatedSavings.bandwidth}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                  bandwidth saved
                </span>
              </div>
            )}
            {estimatedSavings.monthlyCost && (
              <div>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
                  {estimatedSavings.monthlyCost}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                  monthly savings
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
