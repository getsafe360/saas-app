// lib/db/postgres.ts
// Shared postgres-js client for WordPress and other API routes
// Prevents connection pool exhaustion by using singleton pattern

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';

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

    globalForDb.postgresClient = postgres(process.env.DATABASE_URL, {
      max: 10, // Maximum pool size
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
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
