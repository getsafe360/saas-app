// lib/db/client.ts
// Create this file if you don't have a db instance exported yet

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { withSecureSslMode } from './connection-string';

// Disable prefetch as it's not supported for "Transaction" pool mode
const queryClient = postgres(withSecureSslMode(process.env.DATABASE_URL!), {
  prepare: false, // Disable prepared statements for serverless
});

export const db = drizzle(queryClient, { schema });

// Optional: Export types
export type Database = typeof db;