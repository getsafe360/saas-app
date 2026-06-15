// app/api/sites/[id]/wordpress/clear-fixes/route.ts
// POST /api/sites/[id]/wordpress/clear-fixes
//
// Calls the WordPress connector's DELETE /fixes endpoint to remove every
// injected fix snippet from wp_head in one operation. Use this when bad
// snippets are rendering visibly on the site.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDrizzle } from "@/lib/db/postgres";
import { sites } from "@/lib/db/schema/sites/sites";
import { users } from "@/lib/db/schema/auth/users";
import { WordPressClient } from "@/lib/wordpress/client";

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (!dbUser) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl, tokenHash: sites.tokenHash, connectionStatus: sites.connectionStatus })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) return NextResponse.json({ error: "SITE_NOT_FOUND" }, { status: 404 });

  if (site.connectionStatus !== "connected" || !site.tokenHash) {
    return NextResponse.json({ error: "SITE_NOT_CONNECTED" }, { status: 409 });
  }

  try {
    const wpClient = new WordPressClient({
      siteUrl: site.siteUrl,
      tokenHash: site.tokenHash,
      timeout: 15000,
    });

    const result = await wpClient.clearAllFixes();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "CLEAR_FAILED", message: (err as Error).message },
      { status: 502 },
    );
  }
}
