// app/api/admin/db/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDb, hasDb } from "@/lib/db/drizzle";

export async function GET() {
  try {
    if (!hasDb) {
      return NextResponse.json({ ok: false, error: "POSTGRES_URL missing" }, { status: 500 });
    }
    const db = getDb();
    // @ts-ignore - raw query via db.$client
    const client = (db as any).client as import("pg").Pool;
    const r = await client.query(`select version(), current_database() as db, current_user as user`);
    const row = r.rows[0] || {};
    return NextResponse.json({ ok: true, version: row.version, database: row.db, user: row.user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}
