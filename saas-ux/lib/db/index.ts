// lib/db/index.ts
// This file should export both your schema AND the db instance

// Export all schema tables and types
export * from './schema';

// Export the database instance
// Choose ONE of these based on where your db is:

// Option 1: If you created client.ts
export { db } from './client';

// Option 2: If db is in a parent directory
// export { db } from '../database';

// Option 3: If you need to create it inline:
// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// import * as schema from './schema';
// const queryClient = postgres(process.env.DATABASE_URL!);
// export const db = drizzle(queryClient, { schema });