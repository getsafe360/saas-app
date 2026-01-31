// components/reports/templates/ScorecardBreakdown.tsx
// Performance Scorecard breakdown section for PDF reports

import type { PerformanceScorecardData } from '@/lib/db/schema/reports/performance-scorecard';

interface ScorecardBreakdownProps {
  scorecard: PerformanceScorecardData;
  primaryColor?: string;
}

export function ScorecardBreakdown({
  scorecard,
  primaryColor = '#2563eb',
}: ScorecardBreakdownProps) {
  const categories = [
    { letter: 'A', name: 'Core Web Vitals', score: scorecard.coreWebVitals.total, maxScore: 20 },
    { letter: 'B', name: 'Images', score: scorecard.images.total, maxScore: 14 },
    { letter: 'C', name: 'CSS', score: scorecard.css.total, maxScore: 10 },
    { letter: 'D', name: 'JavaScript', score: scorecard.javascript.total, maxScore: 14 },
    { letter: 'E', name: 'Fonts', score: scorecard.fonts.total, maxScore: 8 },
    { letter: 'F', name: 'Network & Compression', score: scorecard.network.total, maxScore: 10 },
    { letter: 'G', name: 'Caching', score: scorecard.caching.total, maxScore: 8 },
    { letter: 'H', name: 'Server/TTFB', score: scorecard.server.total, maxScore: 8 },
    { letter: 'I', name: 'Third-Party Control', score: scorecard.thirdParty.total, maxScore: 8 },
    { letter: 'J', name: 'DOM & Rendering', score: scorecard.domRendering.total, maxScore: 6 },
  ];

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="scorecard-breakdown" style={{ marginBottom: '32px' }}>
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f2937',
        }}
      >
        Performance Scorecard Breakdown
      </h2>

      {/* Total Score Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          backgroundColor: primaryColor,
          borderRadius: '8px 8px 0 0',
          color: '#ffffff',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Score</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>
            {scorecard.totalScore}/100
          </div>
        </div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 700,
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
          }}
        >
          {scorecard.grade}
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                Category
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                  width: '100px',
                }}
              >
                Score
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                  width: '200px',
                }}
              >
                Progress
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, index) => {
              const percentage = (cat.score / cat.maxScore) * 100;
              const statusColor = getStatusColor(percentage);

              return (
                <tr
                  key={cat.letter}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor,
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {cat.letter}
                      </span>
                      <span style={{ fontSize: '14px', color: '#1f2937' }}>
                        {cat.name}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: statusColor,
                      }}
                    >
                      {Math.round(cat.score)}/{cat.maxScore}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: statusColor,
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
