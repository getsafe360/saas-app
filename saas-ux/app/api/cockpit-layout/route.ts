// app/api/cockpit-layout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/drizzle';
import { cockpitLayouts, type CockpitLayoutData, type CockpitCardLayout } from '@/lib/db/schema/features/cockpit-layouts';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
// Need to import users table
import { users } from '@/lib/db/schema/auth/users';

// Default layout for new users
const DEFAULT_LAYOUT: CockpitLayoutData = {
  version: 1,
  cards: [
    { id: 'quick-wins', visible: true, minimized: false, order: 0 },
    { id: 'performance', visible: true, minimized: false, order: 1 },
    { id: 'security', visible: true, minimized: false, order: 2 },
    { id: 'seo', visible: true, minimized: false, order: 3 },
    { id: 'accessibility', visible: true, minimized: false, order: 4 },
    { id: 'wordpress', visible: true, minimized: false, order: 5 },
    { id: 'technology', visible: true, minimized: false, order: 6 },
    { id: 'mobile', visible: true, minimized: false, order: 7 },
    { id: 'network', visible: true, minimized: false, order: 8 },
  ],
};

// Helper to get user ID from Clerk
async function getUserId(): Promise<number | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user?.id ?? null;
}

/**
 * GET /api/cockpit-layout?siteId=xxx
 * 
 * Returns the layout for a specific site, or user's default, or system default.
 * Priority: site-specific > user-default > system-default
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    const db = getDb();

    // Try to get site-specific layout first
    if (siteId) {
      const [siteLayout] = await db
        .select()
        .from(cockpitLayouts)
        .where(
          and(
            eq(cockpitLayouts.userId, userId),
            eq(cockpitLayouts.siteId, siteId)
          )
        )
        .limit(1);

      if (siteLayout) {
        return NextResponse.json({
          ok: true,
          layout: siteLayout.layout,
          source: 'site',
        });
      }
    }

    // Fall back to user's default layout
    const [userDefault] = await db
      .select()
      .from(cockpitLayouts)
      .where(
        and(
          eq(cockpitLayouts.userId, userId),
          isNull(cockpitLayouts.siteId)
        )
      )
      .limit(1);

    if (userDefault) {
      return NextResponse.json({
        ok: true,
        layout: userDefault.layout,
        source: 'user-default',
      });
    }

    // Fall back to system default
    return NextResponse.json({
      ok: true,
      layout: DEFAULT_LAYOUT,
      source: 'system-default',
    });
  } catch (error) {
    console.error('Error fetching cockpit layout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cockpit-layout
 * 
 * Save or update a cockpit layout.
 * Body: { siteId?: string, layout: CockpitLayoutData }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, layout } = body as {
      siteId?: string;
      layout: CockpitLayoutData;
    };

    if (!layout || !Array.isArray(layout.cards)) {
      return NextResponse.json(
        { error: 'Invalid layout data' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Upsert the layout
    const existingCondition = siteId
      ? and(eq(cockpitLayouts.userId, userId), eq(cockpitLayouts.siteId, siteId))
      : and(eq(cockpitLayouts.userId, userId), isNull(cockpitLayouts.siteId));

    const [existing] = await db
      .select({ id: cockpitLayouts.id })
      .from(cockpitLayouts)
      .where(existingCondition)
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(cockpitLayouts)
        .set({
          layout,
          updatedAt: new Date(),
        })
        .where(eq(cockpitLayouts.id, existing.id));
    } else {
      // Insert new
      await db.insert(cockpitLayouts).values({
        userId,
        siteId: siteId || null,
        layout,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving cockpit layout:', error);
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cockpit-layout?siteId=xxx
 * 
 * Delete a site-specific layout (revert to user default).
 * If no siteId, deletes user default (revert to system default).
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    const db = getDb();

    const deleteCondition = siteId
      ? and(eq(cockpitLayouts.userId, userId), eq(cockpitLayouts.siteId, siteId))
      : and(eq(cockpitLayouts.userId, userId), isNull(cockpitLayouts.siteId));

    await db.delete(cockpitLayouts).where(deleteCondition);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting cockpit layout:', error);
    return NextResponse.json(
      { error: 'Failed to delete layout' },
      { status: 500 }
    );
  }
}
