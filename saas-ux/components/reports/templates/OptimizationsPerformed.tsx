// components/reports/templates/OptimizationsPerformed.tsx
// List of optimizations performed for PDF reports

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

interface OptimizationsPerformedProps {
  optimizations: OptimizationItem[];
  primaryColor?: string;
}

export function OptimizationsPerformed({
  optimizations,
  primaryColor = '#2563eb',
}: OptimizationsPerformedProps) {
  const completedOptimizations = optimizations.filter((o) => o.status === 'completed');
  const pendingOptimizations = optimizations.filter((o) => o.status === 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'pending':
        return '○';
      case 'skipped':
        return '—';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'skipped':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="optimizations-performed" style={{ marginBottom: '32px' }}>
      <h2
        style={{
          margin: '0 0 20px',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f2937',
        }}
      >
        Optimizations Performed
      </h2>

      {/* Completed Optimizations */}
      {completedOptimizations.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#10b98120',
                fontSize: '12px',
              }}
            >
              ✓
            </span>
            Completed ({completedOptimizations.length})
          </h3>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {completedOptimizations.map((opt, index) => (
              <div
                key={opt.id}
                style={{
                  padding: '16px',
                  borderBottom:
                    index < completedOptimizations.length - 1
                      ? '1px solid #e5e7eb'
                      : 'none',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1f2937',
                        marginBottom: '4px',
                      }}
                    >
                      {opt.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {opt.category}
                    </div>
                    {opt.description && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginTop: '8px',
                        }}
                      >
                        {opt.description}
                      </div>
                    )}
                  </div>

                  {(opt.before || opt.after || opt.savings) && (
                    <div style={{ textAlign: 'right' }}>
                      {opt.before && opt.after && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          <span style={{ textDecoration: 'line-through' }}>
                            {opt.before}
                          </span>
                          <span style={{ margin: '0 8px' }}>→</span>
                          <span
                            style={{ fontWeight: 600, color: '#10b981' }}
                          >
                            {opt.after}
                          </span>
                        </div>
                      )}
                      {opt.savings && (
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#10b981',
                            marginTop: '4px',
                          }}
                        >
                          {opt.savings} saved
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending/Recommended Optimizations */}
      {pendingOptimizations.length > 0 && (
        <div>
          <h3
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b20',
                fontSize: '12px',
              }}
            >
              ○
            </span>
            Recommended ({pendingOptimizations.length})
          </h3>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {pendingOptimizations.map((opt, index) => (
              <div
                key={opt.id}
                style={{
                  padding: '16px',
                  borderBottom:
                    index < pendingOptimizations.length - 1
                      ? '1px solid #e5e7eb'
                      : 'none',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1f2937',
                        marginBottom: '4px',
                      }}
                    >
                      {opt.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {opt.category}
                    </div>
                  </div>

                  {opt.savings && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#f59e0b',
                        fontWeight: 500,
                      }}
                    >
                      Potential: {opt.savings}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {optimizations.length === 0 && (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          No optimizations recorded for this report.
        </div>
      )}
    </div>
  );
}
