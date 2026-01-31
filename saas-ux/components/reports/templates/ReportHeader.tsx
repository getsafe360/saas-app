// components/reports/templates/ReportHeader.tsx
// PDF Report Header with branding support

import type { BrandingConfig } from '@/lib/db/schema/reports/branding';

interface ReportHeaderProps {
  siteName: string;
  siteUrl: string;
  generatedAt: Date;
  reportType: 'performance' | 'security' | 'seo' | 'accessibility' | 'full';
  branding?: {
    companyName: string;
    logoUrl?: string | null;
    config: BrandingConfig;
  };
}

export function ReportHeader({
  siteName,
  siteUrl,
  generatedAt,
  reportType,
  branding,
}: ReportHeaderProps) {
  const primaryColor = branding?.config.colors.primary || '#2563eb';
  const textColor = branding?.config.colors.text || '#1f2937';

  const reportTypeLabels: Record<string, string> = {
    performance: 'Performance Optimization Report',
    security: 'Security Audit Report',
    seo: 'SEO Analysis Report',
    accessibility: 'Accessibility Report',
    full: 'Complete Site Analysis Report',
  };

  return (
    <div className="report-header" style={{ marginBottom: '32px' }}>
      {/* Logo and Company Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${primaryColor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              style={{ height: '48px', maxWidth: '200px', objectFit: 'contain' }}
            />
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: textColor }}>
              {branding?.companyName || 'GetSafe 360 AI'}
            </h2>
            {branding?.config.tagline && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                {branding.config.tagline}
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
            Generated on
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 500, color: textColor }}>
            {generatedAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Report Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            color: primaryColor,
          }}
        >
          {reportTypeLabels[reportType]}
        </h1>
        <div style={{ marginTop: '12px' }}>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: textColor }}>
            {siteName}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
            {siteUrl}
          </p>
        </div>
      </div>
    </div>
  );
}
