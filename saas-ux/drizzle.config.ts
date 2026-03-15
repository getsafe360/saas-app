// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',

  // Your schema folder stays the same
  schema: './lib/db/schema',

  // Your migrations folder stays the same
  out: './lib/db/migrations',

  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL!,
  },

  verbose: true,
  strict: true,

  // 🔥 NEW MIGRATOR MODE — no snapshots, no auto-generation
  migrations: {
    table: '__drizzle_migrations',   // migration journal table
    schema: 'drizzle',               // journal lives in schema "drizzle"
    mode: 'custom',                  // <— THE IMPORTANT PART
  },
});
