// app/api/admin/db/inspect/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb, hasDb } from "@/lib/db/drizzle";

const TABLES_SQL = `
select
  n.nspname as schema,
  c.relname as name,
  c.relkind as kind,
  pg_total_relation_size(c.oid) as bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog','information_schema')
  and c.relkind in ('r','p','v','m')  -- tables/partitions/views/mviews
order by bytes desc, name asc
`;

export async function GET(req: NextRequest) {
  try {
    if (!hasDb) return NextResponse.json({ ok: false, error: "POSTGRES_URL missing" }, { status: 500 });
    const db = getDb();
    // @ts-ignore raw client
    const client = (db as any).client as import("pg").Pool;

    const t = await client.query(TABLES_SQL);
    const tables = t.rows as { schema: string; name: string; kind: string; bytes: number }[];

    // Optionally compute row counts for top N tables to keep it fast:
    const top = tables.slice(0, 20);
    const counts: Record<string, number> = {};
    for (const row of top) {
      if (row.kind === "r" || row.kind === "p") {
        try {
          const q = await client.query(`select count(*)::int as c from "${row.schema}"."${row.name}"`);
          counts[`${row.schema}.${row.name}`] = q.rows[0]?.c ?? 0;
        } catch {
          counts[`${row.schema}.${row.name}`] = -1; // cannot count (e.g., permissions)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tables: tables.map(r => ({
        schema: r.schema,
        name: r.name,
        kind: r.kind,
        bytes: r.bytes,
        rows: counts[`${r.schema}.${r.name}`],
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}
