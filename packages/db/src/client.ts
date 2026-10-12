import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type DatabaseInstance = ReturnType<typeof createDbClient>;

export interface DatabaseOptions {
  connectionString?: string;
  maxConnections?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
}

/**
 * Creates an isolated database client with connection pooling and typed schema.
 */
export function createDbClient(options: DatabaseOptions = {}) {
  const connectionString =
    options.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://localhost:5432/marketplace_dev';

  const client = postgres(connectionString, {
    max: options.maxConnections || 10,
    idle_timeout: options.idleTimeoutSeconds || 20,
    connect_timeout: options.connectTimeoutSeconds || 10,
    onnotice: () => {}, // suppress notice spam in tests
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}

let defaultInstance: DatabaseInstance | null = null;

/**
 * Returns the singleton database instance for the application runtime.
 */
export function getDb(): DatabaseInstance {
  if (!defaultInstance) {
    defaultInstance = createDbClient();
  }
  return defaultInstance;
}
