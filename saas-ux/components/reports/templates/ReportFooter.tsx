// components/reports/templates/ReportFooter.tsx
// PDF Report Footer with branding support

import type { BrandingConfig, BrandingContact } from '@/lib/db/schema/reports/branding';

interface ReportFooterProps {
  pageNumber?: number;
  totalPages?: number;
  branding?: {
    companyName: string;
    config: BrandingConfig;
  };
  showPoweredBy?: boolean;
}

export function ReportFooter({
  pageNumber,
  totalPages,
  branding,
  showPoweredBy = true,
}: ReportFooterProps) {
  const primaryColor = branding?.config.colors.primary || '#2563eb';
  const contact = branding?.config.contact || {};
  const footerText = branding?.config.footerText;
  const shouldShowPoweredBy = branding?.config.showPoweredBy ?? showPoweredBy;

  return (
    <div
      className="report-footer"
      style={{
        marginTop: '48px',
        paddingTop: '24px',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: '11px',
          color: '#6b7280',
        }}
      >
        {/* Left: Contact Info */}
        <div>
          {branding?.companyName && (
            <div
              style={{
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: '4px',
              }}
            >
              {branding.companyName}
            </div>
          )}
          {contact.email && <div>{contact.email}</div>}
          {contact.phone && <div>{contact.phone}</div>}
          {contact.website && <div>{contact.website}</div>}
        </div>

        {/* Center: Custom Footer Text or Powered By */}
        <div style={{ textAlign: 'center' }}>
          {footerText && (
            <div style={{ marginBottom: '4px' }}>{footerText}</div>
          )}
          {shouldShowPoweredBy && (
            <div style={{ color: '#9ca3af' }}>
              Powered by{' '}
              <span style={{ color: primaryColor, fontWeight: 500 }}>
                GetSafe 360 AI
              </span>
            </div>
          )}
        </div>

        {/* Right: Page Number */}
        <div style={{ textAlign: 'right' }}>
          {pageNumber && totalPages && (
            <div>
              Page {pageNumber} of {totalPages}
            </div>
          )}
          <div style={{ marginTop: '4px', color: '#9ca3af' }}>
            Report generated on {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
