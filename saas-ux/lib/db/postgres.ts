// lib/db/postgres.ts
// Shared postgres-js client for WordPress and other API routes
// Prevents connection pool exhaustion by using singleton pattern

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';
import { withSecureSslMode } from '@/lib/db/connection-string';

// Global singleton pattern to prevent multiple connection pools
const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  drizzleDb?: ReturnType<typeof drizzle<typeof schema>>;
};

/**
 * Get shared postgres-js client instance
 *
 * Creates a singleton connection pool that is reused across all API routes
 * Prevents connection pool exhaustion in serverless environments
 *
 * @returns Postgres client instance
 */
export function getPostgresClient(): ReturnType<typeof postgres> {
  if (!globalForDb.postgresClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    globalForDb.postgresClient = postgres(withSecureSslMode(process.env.DATABASE_URL), {
      max: 10, // Maximum pool size
      idle_timeout: 60, // Close idle connections after 60 seconds (better for serverless)
      connect_timeout: 30, // Connection timeout in seconds (more forgiving for serverless cold starts)
    });
  }

  return globalForDb.postgresClient;
}

/**
 * Get shared Drizzle ORM instance with postgres-js
 *
 * Creates a singleton Drizzle instance that reuses the postgres-js client
 * Prevents connection pool exhaustion in serverless environments
 *
 * @returns Drizzle ORM instance
 */
export function getDrizzle(): ReturnType<typeof drizzle<typeof schema>> {
  if (!globalForDb.drizzleDb) {
    const client = getPostgresClient();
    globalForDb.drizzleDb = drizzle(client, { schema });
  }

  return globalForDb.drizzleDb;
}
