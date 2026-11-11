// app/api/reports/branding/route.ts
//
// White-label branding for client reports (Agency plan).
// GET: the team's branding (or null). PUT: save it. DELETE: remove it.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { reportBranding } from '@/lib/db/schema';
import type { BrandingConfig } from '@/lib/db/schema/reports/branding';
import { findCurrentUserTeam } from '@/lib/auth/current';
import { canUseWhiteLabel, isPlanName } from '@/lib/plans/config';
import { rateLimit } from '@/lib/api/rate-limit';
import { DEFAULT_PRIMARY_COLOR, parseBrandingInput } from '@/lib/reports/branding';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function agencyTeam() {
  const team = await findCurrentUserTeam();
  if (!team) return { error: json({ success: false, error: 'UNAUTHORIZED' }, 401) } as const;
  const plan = isPlanName(team.planName) ? team.planName : 'free';
  return { team, allowed: canUseWhiteLabel(plan) } as const;
}

function toView(row: typeof reportBranding.$inferSelect | undefined) {
  if (!row) return null;
  return {
    companyName: row.companyName,
    logoUrl: row.logoUrl,
    primaryColor: row.config?.colors?.primary ?? DEFAULT_PRIMARY_COLOR,
    website: row.config?.contact?.website ?? null,
    email: row.config?.contact?.email ?? null,
    footerText: row.config?.footerText ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const access = await agencyTeam();
  if ('error' in access) return access.error;
  if (!access.allowed) return json({ success: true, allowed: false, branding: null });
  const [row] = await getDb().select().from(reportBranding).where(eq(reportBranding.teamId, access.team.id)).limit(1);
  return json({ success: true, allowed: true, branding: toView(row) });
}

export async function PUT(request: NextRequest) {
  const access = await agencyTeam();
  if ('error' in access) return access.error;
  if (!access.allowed) return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);

  const limited = await rateLimit(`branding-save:${access.team.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return json({ success: false, error: 'RATE_LIMITED' }, 429);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseBrandingInput(body);
  if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);
  const input = parsed.value;

  const config: BrandingConfig = {
    colors: { primary: input.primaryColor, secondary: input.primaryColor, accent: input.primaryColor, background: '#ffffff', text: '#1f2937' },
    contact: { website: input.website ?? undefined, email: input.email ?? undefined },
    footerText: input.footerText ?? undefined,
    showPoweredBy: false,
  };
  const values = { companyName: input.companyName, logoUrl: input.logoUrl, logoLightUrl: null, config, updatedAt: new Date() };

  const [row] = await getDb()
    .insert(reportBranding)
    .values({ teamId: access.team.id, ...values })
    .onConflictDoUpdate({ target: reportBranding.teamId, set: values })
    .returning();
  return json({ success: true, branding: toView(row) });
}

export async function DELETE() {
  const access = await agencyTeam();
  if ('error' in access) return access.error;
  await getDb().delete(reportBranding).where(eq(reportBranding.teamId, access.team.id));
  return json({ success: true, branding: null });
}
