// components/reports/templates/BeforeAfterSection.tsx
// Before/After comparison section for PDF reports

interface MetricComparison {
  label: string;
  before: string | number;
  after: string | number;
  unit?: string;
  improvement?: string;
}

interface BeforeAfterSectionProps {
  metrics: MetricComparison[];
  screenshotBefore?: string;
  screenshotAfter?: string;
  primaryColor?: string;
}

export function BeforeAfterSection({
  metrics,
  screenshotBefore,
  screenshotAfter,
  primaryColor = '#2563eb',
}: BeforeAfterSectionProps) {
  return (
    <div className="before-after-section" style={{ marginBottom: '32px' }}>
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f2937',
        }}
      >
        Before & After Comparison
      </h2>

      {/* Metrics Comparison Table */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                Metric
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ef4444',
                  backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #e5e7eb',
                  width: '120px',
                }}
              >
                Before
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#10b981',
                  backgroundColor: '#ecfdf5',
                  borderBottom: '1px solid #e5e7eb',
                  width: '120px',
                }}
              >
                After
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: primaryColor,
                  backgroundColor: `${primaryColor}10`,
                  borderBottom: '1px solid #e5e7eb',
                  width: '120px',
                }}
              >
                Improvement
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => (
              <tr
                key={metric.label}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                }}
              >
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1f2937',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {metric.label}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#ef4444',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {metric.before}
                  {metric.unit && (
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {' '}
                      {metric.unit}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#10b981',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {metric.after}
                  {metric.unit && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: 400,
                      }}
                    >
                      {' '}
                      {metric.unit}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: primaryColor,
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {metric.improvement || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual Screenshots Comparison */}
      {(screenshotBefore || screenshotAfter) && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
          }}
        >
          {screenshotBefore && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ef4444',
                  marginBottom: '8px',
                  textAlign: 'center',
                }}
              >
                Before
              </div>
              <div
                style={{
                  border: '2px solid #fecaca',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={screenshotBefore}
                  alt="Before optimization"
                  style={{ width: '100%', display: 'block' }}
                />
              </div>
            </div>
          )}
          {screenshotAfter && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#10b981',
                  marginBottom: '8px',
                  textAlign: 'center',
                }}
              >
                After
              </div>
              <div
                style={{
                  border: '2px solid #a7f3d0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={screenshotAfter}
                  alt="After optimization"
                  style={{ width: '100%', display: 'block' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
