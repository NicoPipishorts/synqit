import { readRequiredEnv } from '@synqit/shared';
import { Pool } from 'pg';

let pool: Pool | null = null;
let initializePromise: Promise<void> | null = null;

// Created lazily so `.env` is loaded and DATABASE_URL validated before the first
// connection. There is deliberately no fallback connection string.
const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({ connectionString: readRequiredEnv(process.env, 'DATABASE_URL') });
  }

  return pool;
};

const checkDatabaseConnection = async (): Promise<void> => {
  await getPool().query('SELECT 1');
};

/**
 * Verifies connectivity only. Schema changes belong exclusively to Prisma
 * migrations (`yarn prisma:migrate:deploy`); the API never mutates the schema.
 */
export const initializeDatabase = async (): Promise<void> => {
  if (!initializePromise) {
    initializePromise = checkDatabaseConnection();
  }

  await initializePromise;
};

export const closeDatabase = async (): Promise<void> => {
  initializePromise = null;
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end();
  }
};
