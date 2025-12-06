// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema',
  out: './lib/db/migrations',           // single canonical folder (commit SQL + meta)
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,                         // fail fast if meta/journal are inconsistent
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',                  // journal lives in schema "drizzle"
  },
});
