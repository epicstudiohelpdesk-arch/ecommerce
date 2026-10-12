import { createDbClient } from '../src/client.js';
import { runMigrations } from '../src/migrate.js';
import postgres from 'postgres';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/marketplace_test';

export async function resetTestDatabase() {
  const adminClient = postgres(TEST_DB_URL, { max: 1 });
  try {
    // Drop all tables, types, and migration tracking schemas
    await adminClient.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO CURRENT_USER;
      GRANT ALL ON SCHEMA public TO public;
    `);
  } finally {
    await adminClient.end();
  }

  // Apply migrations cleanly
  await runMigrations(TEST_DB_URL);
}

export function createIsolatedTestClient() {
  return createDbClient({
    connectionString: TEST_DB_URL,
    maxConnections: 5,
  });
}
