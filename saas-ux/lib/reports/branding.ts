// lib/reports/branding.ts
//
// Validates the Agency branding form. Only a logo uploaded to our own storage
// is accepted, so a report never points at an address a user typed in.

export const BRANDING_LIMITS = { companyName: 120, footerText: 300, website: 200, email: 200 } as const;

export interface BrandingInput {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  website: string | null;
  email: string | null;
  footerText: string | null;
}

export type BrandingError = 'COMPANY_REQUIRED' | 'INVALID_LOGO' | 'INVALID_COLOR' | 'INVALID_WEBSITE' | 'INVALID_EMAIL' | 'TOO_LONG';

export const DEFAULT_PRIMARY_COLOR = '#2563eb';
const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A logo stored by our upload route (Vercel Blob, under branding/). */
export function isOwnLogoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && BLOB_HOST.test(url.hostname) && url.pathname.startsWith('/branding/');
  } catch {
    return false;
  }
}

export function parseBrandingInput(body: Record<string, unknown>): { ok: true; value: BrandingInput } | { ok: false; error: BrandingError } {
  const companyName = text(body.companyName);
  const logo = text(body.logoUrl);
  const color = text(body.primaryColor) || DEFAULT_PRIMARY_COLOR;
  const website = text(body.website);
  const email = text(body.email);
  const footerText = text(body.footerText);

  if (!companyName) return { ok: false, error: 'COMPANY_REQUIRED' };
  if (
    companyName.length > BRANDING_LIMITS.companyName ||
    footerText.length > BRANDING_LIMITS.footerText ||
    website.length > BRANDING_LIMITS.website ||
    email.length > BRANDING_LIMITS.email
  ) {
    return { ok: false, error: 'TOO_LONG' };
  }
  if (logo && !isOwnLogoUrl(logo)) return { ok: false, error: 'INVALID_LOGO' };
  if (!HEX.test(color)) return { ok: false, error: 'INVALID_COLOR' };

  let normalisedWebsite: string | null = null;
  if (website) {
    try {
      const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
      if (!url.hostname.includes('.')) throw new Error('host');
      normalisedWebsite = url.toString().replace(/\/$/, '');
    } catch {
      return { ok: false, error: 'INVALID_WEBSITE' };
    }
  }
  if (email && !EMAIL.test(email)) return { ok: false, error: 'INVALID_EMAIL' };

  return {
    ok: true,
    value: {
      companyName,
      logoUrl: logo || null,
      primaryColor: color.toLowerCase(),
      website: normalisedWebsite,
      email: email || null,
      footerText: footerText || null,
    },
  };
}

/** Recognises the image types we accept by their first bytes, not the declared type. */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | 'gif' | null {
  const at = (offset: number, ...values: number[]) => values.every((value, index) => bytes[offset + index] === value);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpg';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
  return null;
}

export const LOGO_MAX_BYTES = 512 * 1024;
