// lib/reports/logo.ts
//
// The branding logo is fetched here, with every redirect hop checked against
// public addresses, and embedded as a data URL. Chromium then never loads a URL
// a user supplied, so a logo cannot become a way into internal services.

import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { fetchFollowingSafely } from '@/lib/net/safeFetch';

const MAX_BYTES = 512 * 1024;
// No SVG: it can carry scripts and external references.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function logoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
    const response = await fetchFollowingSafely(url, { timeoutMs: 5000, validate: isPublicUrlResolved });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(type)) return null;
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}
