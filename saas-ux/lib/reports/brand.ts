// lib/reports/brand.ts
//
// Whose name goes on a report. White-label is an Agency feature: it removes
// GetSafe 360 and, when the team has set up branding, puts theirs in its place.

import { canUseWhiteLabel, type PlanName } from '@/lib/plans/config';
import { isPublicUrl } from '@/lib/net/isPublicUrl';
import { DEFAULT_BRAND, type ReportBrand } from './render';

export interface BrandingRow {
  companyName: string | null;
  logoUrl: string | null;
  config: { colors?: { primary?: string } } | null;
}

function safeLogo(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' && isPublicUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export function resolveBrand(plan: PlanName, whiteLabel: boolean, branding: BrandingRow | null): ReportBrand {
  if (!whiteLabel || !canUseWhiteLabel(plan)) return DEFAULT_BRAND;
  return {
    companyName: branding?.companyName?.trim() || null,
    logoUrl: safeLogo(branding?.logoUrl ?? null),
    primaryColor: branding?.config?.colors?.primary ?? DEFAULT_BRAND.primaryColor,
    poweredBy: false,
  };
}
