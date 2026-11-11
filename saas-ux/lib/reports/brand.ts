// lib/reports/brand.ts
//
// Whose name goes on a report. White-label is an Agency feature: it removes
// GetSafe 360 and, when the team has set up branding, puts theirs in its place.

import { canUseWhiteLabel, type PlanName } from '@/lib/plans/config';
import { DEFAULT_BRAND, type ReportBrand } from './render';

export interface BrandingRow {
  companyName: string | null;
  logoUrl: string | null;
  config: { colors?: { primary?: string }; contact?: { website?: string; email?: string }; footerText?: string } | null;
}

function contactLine(branding: BrandingRow | null): string | null {
  const website = branding?.config?.contact?.website?.replace(/^https?:\/\//, '') ?? null;
  const parts = [website, branding?.config?.contact?.email ?? null].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function resolveBrand(plan: PlanName, whiteLabel: boolean, branding: BrandingRow | null): ReportBrand {
  if (!whiteLabel || !canUseWhiteLabel(plan)) return DEFAULT_BRAND;
  return {
    companyName: branding?.companyName?.trim() || null,
    // A remote URL here; renderReport() replaces it with an embedded copy (lib/reports/logo.ts).
    logoUrl: branding?.logoUrl ?? null,
    primaryColor: branding?.config?.colors?.primary ?? DEFAULT_BRAND.primaryColor,
    poweredBy: false,
    contact: contactLine(branding),
    footerText: branding?.config?.footerText?.trim() || null,
  };
}
