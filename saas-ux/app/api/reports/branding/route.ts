// app/api/reports/branding/route.ts
// White-label branding settings API (Agency plan only)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { teams, teamMembers, reportBranding } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { canUseWhiteLabel, type PlanName } from '@/lib/plans/config';
import type { BrandingConfig } from '@/lib/db/schema/reports/branding';

/**
 * GET /api/reports/branding
 *
 * Get current team's branding settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const db = getDb();

    // Get user's team and plan
    const [membership] = await db
      .select({
        teamId: teamMembers.teamId,
        planName: teams.planName,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const planName = (membership.planName || 'free') as PlanName;

    // Check if plan allows white-label
    if (!canUseWhiteLabel(planName)) {
      return NextResponse.json({
        success: true,
        branding: null,
        upgradeRequired: true,
        requiredPlan: 'agency',
      });
    }

    // Get branding settings
    const [branding] = await db
      .select()
      .from(reportBranding)
      .where(eq(reportBranding.teamId, membership.teamId))
      .limit(1);

    return NextResponse.json({
      success: true,
      branding: branding || null,
    });

  } catch (error: any) {
    console.error('[Branding] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/branding
 *
 * Create or update team's branding settings
 *
 * Body:
 * - companyName: string
 * - logoUrl?: string
 * - logoLightUrl?: string
 * - config: BrandingConfig
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const db = getDb();

    // Get user's team and plan
    const [membership] = await db
      .select({
        teamId: teamMembers.teamId,
        planName: teams.planName,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const planName = (membership.planName || 'free') as PlanName;

    // Check if plan allows white-label
    if (!canUseWhiteLabel(planName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'White-label branding requires Agency plan',
          upgradeRequired: true,
          requiredPlan: 'agency',
        },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();

    if (!body.companyName || typeof body.companyName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Build config with defaults
    const config: BrandingConfig = {
      colors: {
        primary: body.config?.colors?.primary || '#2563eb',
        secondary: body.config?.colors?.secondary || '#1e40af',
        accent: body.config?.colors?.accent || '#3b82f6',
        background: body.config?.colors?.background || '#ffffff',
        text: body.config?.colors?.text || '#1f2937',
      },
      contact: {
        email: body.config?.contact?.email,
        phone: body.config?.contact?.phone,
        website: body.config?.contact?.website,
        address: body.config?.contact?.address,
      },
      tagline: body.config?.tagline,
      footerText: body.config?.footerText,
      showPoweredBy: body.config?.showPoweredBy ?? true,
    };

    // Check if branding already exists
    const [existing] = await db
      .select({ id: reportBranding.id })
      .from(reportBranding)
      .where(eq(reportBranding.teamId, membership.teamId))
      .limit(1);

    let branding;

    if (existing) {
      // Update existing
      [branding] = await db
        .update(reportBranding)
        .set({
          companyName: body.companyName,
          logoUrl: body.logoUrl || null,
          logoLightUrl: body.logoLightUrl || null,
          config,
          updatedAt: new Date(),
        })
        .where(eq(reportBranding.id, existing.id))
        .returning();
    } else {
      // Create new
      [branding] = await db
        .insert(reportBranding)
        .values({
          teamId: membership.teamId,
          companyName: body.companyName,
          logoUrl: body.logoUrl || null,
          logoLightUrl: body.logoLightUrl || null,
          config,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      branding,
    });

  } catch (error: any) {
    console.error('[Branding] PUT error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/branding
 *
 * Remove team's branding (revert to default GetSafe 360 branding)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const db = getDb();

    // Get user's team
    const [membership] = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Delete branding
    await db
      .delete(reportBranding)
      .where(eq(reportBranding.teamId, membership.teamId));

    return NextResponse.json({
      success: true,
      message: 'Branding removed successfully',
    });

  } catch (error: any) {
    console.error('[Branding] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
