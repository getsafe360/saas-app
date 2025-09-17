import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',  // <- your Drizzle schema
  out: './drizzle',              // migrations/output folder
  dialect: 'postgresql',
  dbCredentials: {
    // Works with DATABASE_URL or POSTGRES_URL (Neon/Vercel PG etc.)
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
});
