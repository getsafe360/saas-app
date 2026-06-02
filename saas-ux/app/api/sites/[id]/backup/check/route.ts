// app/api/sites/[id]/backup/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { siteBackups } from '@/lib/db/schema';

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const backups = await db
      .select({
        id: siteBackups.id,
        method: siteBackups.method,
        status: siteBackups.status,
        includes: siteBackups.includes,
        sizeBytes: siteBackups.sizeBytes,
        createdAt: siteBackups.createdAt,
        expiresAt: siteBackups.expiresAt,
      })
      .from(siteBackups)
      .where(
        and(
          eq(siteBackups.siteId, id),
          eq(siteBackups.status, 'ready')
        )
      )
      .orderBy(desc(siteBackups.createdAt))
      .limit(10);

    const latest = backups[0] ?? null;
    const now = new Date();

    return NextResponse.json({
      available: backups.length > 0,
      count: backups.length,
      latest: latest
        ? {
            id: latest.id,
            method: latest.method,
            createdAt: latest.createdAt.toISOString(),
            expiresAt: latest.expiresAt?.toISOString() ?? null,
            expired: latest.expiresAt ? latest.expiresAt < now : false,
            sizeBytes: latest.sizeBytes,
            includes: latest.includes,
          }
        : null,
      backups: backups.map((b) => ({
        id: b.id,
        method: b.method,
        createdAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt?.toISOString() ?? null,
        expired: b.expiresAt ? b.expiresAt < now : false,
        sizeBytes: b.sizeBytes,
        includes: b.includes,
      })),
    });

  } catch (error: any) {
    console.error(`[Backup Check] Error for site ${id}:`, error);
    return NextResponse.json(
      { available: false, count: 0, latest: null, backups: [], error: error.message },
      { status: 500 }
    );
  }
}
