// app/api/reports/branding/logo/route.ts
//
// POST (multipart, field "file"): stores an Agency logo and returns its URL,
// which the branding form then saves. PNG, JPEG, WebP or GIF up to 512 KB,
// recognised by content, not by the declared type. No SVG.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { findCurrentUserTeam } from '@/lib/auth/current';
import { canUseWhiteLabel, isPlanName } from '@/lib/plans/config';
import { rateLimit } from '@/lib/api/rate-limit';
import { LOGO_MAX_BYTES, sniffImageType } from '@/lib/reports/branding';

const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as const;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  const team = await findCurrentUserTeam();
  if (!team) return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  if (!canUseWhiteLabel(isPlanName(team.planName) ? team.planName : 'free')) {
    return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);
  }
  const limited = await rateLimit(`branding-logo:${team.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return json({ success: false, error: 'RATE_LIMITED' }, 429);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > LOGO_MAX_BYTES + 64 * 1024) return json({ success: false, error: 'LOGO_TOO_LARGE' }, 413);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return json({ success: false, error: 'INVALID_LOGO' }, 400);
  if (file.size > LOGO_MAX_BYTES) return json({ success: false, error: 'LOGO_TOO_LARGE' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes);
  if (!kind) return json({ success: false, error: 'INVALID_LOGO' }, 400);

  const blob = await put(`branding/${team.id}/logo.${kind}`, Buffer.from(bytes), {
    access: 'public',
    addRandomSuffix: true,
    contentType: CONTENT_TYPES[kind],
  });
  return json({ success: true, logoUrl: blob.url });
}
