// app/api/admin/db/sample/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb, hasDb } from "@/lib/db/drizzle";

export async function GET(req: NextRequest) {
  try {
    if (!hasDb) return NextResponse.json({ ok: false, error: "POSTGRES_URL missing" }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const schema = searchParams.get("schema") || "public";
    const table = searchParams.get("table");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10) || 10, 100);

    if (!table) {
      return NextResponse.json({ ok: false, error: "Provide ?table=name[&schema=public][&limit=10]" }, { status: 400 });
    }

    const db = getDb();
    // @ts-ignore raw client
    const client = (db as any).client as import("pg").Pool;

    const q = await client.query(`select * from "${schema}"."${table}" order by 1 desc limit $1`, [limit]);
    return NextResponse.json({ ok: true, schema, table, limit, rows: q.rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}
