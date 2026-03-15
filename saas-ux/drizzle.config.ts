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

  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle'
  },
});
