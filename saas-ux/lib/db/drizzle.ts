// lib/db/drizzle.ts
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withSecureSslMode } from "@/lib/db/connection-string";

export const hasDb = !!process.env.POSTGRES_URL;

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!hasDb) {
      throw new Error("POSTGRES_URL is not set");
    }
    const pool = new Pool({
      connectionString: withSecureSslMode(process.env.POSTGRES_URL!),
      max: 5,
      // Helpful in serverless
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    _db = drizzle(pool);
  }
  return _db!;
}
