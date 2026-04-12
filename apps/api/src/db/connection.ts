// ── PostgreSQL + Drizzle Connection ─────────────
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config';
import { logger } from '../observability/logger';
import * as schema from './schema';

// ── Create postgres.js client ──────────────────────────────────────────────────
const queryClient = postgres(config.db.url, {
  max: 10,                // connection pool size
  idle_timeout: 30,       // close idle connections after 30s
  connect_timeout: 10,    // fail connection after 10s
  onnotice: () => {},     // suppress NOTICE messages
});

// ── Drizzle ORM instance ───────────────────────────────────────────────────────
export const db = drizzle(queryClient, { schema });

// ── Raw SQL client (for pgvector queries) ─────────────────────────────────────
export const sql = queryClient;

// ── Connection Validation ──────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export async function connectDatabase(): Promise<void> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Run a simple query to verify the connection
      await queryClient`SELECT 1`;
      logger.info('Connected to PostgreSQL');
      return;
    } catch (err) {
      retries++;
      logger.warn({ err, retries }, `PostgreSQL connection failed, retrying in ${RETRY_DELAY_MS}ms...`);
      if (retries >= MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
