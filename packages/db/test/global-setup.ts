import { resetTestDatabase } from './test-db.js';

export async function setup() {
  console.log('[TEST-DB] Initializing test database from clean migrations...');
  await resetTestDatabase();
  console.log('[TEST-DB] Test database initialized and ready.');
}
