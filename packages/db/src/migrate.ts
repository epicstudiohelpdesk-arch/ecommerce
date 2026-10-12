import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(connectionString?: string) {
  const targetUrl =
    connectionString || process.env.DATABASE_URL || 'postgresql://localhost:5432/marketplace_dev';

  const { db, close } = createDbClient({ connectionString: targetUrl, maxConnections: 1 });

  const migrationsFolder = path.resolve(__dirname, '../migrations');

  console.log(`[DB] Running migrations from: ${migrationsFolder}`);
  console.log(`[DB] Target database: ${targetUrl.replace(/\/\/[^@]+@/, '//***@')}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('[DB] Migrations applied successfully.');
  } finally {
    await close();
  }
}

// Allow direct CLI execution via tsx/node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DB] Migration failed:', err);
      process.exit(1);
    });
}
