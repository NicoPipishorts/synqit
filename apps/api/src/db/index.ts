import { Pool } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://synqit:synqit@localhost:5435/synqit';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

const checkDatabaseConnection = async (): Promise<void> => {
  await pool.query('SELECT 1');
};

let initializePromise: Promise<void> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  if (!initializePromise) {
    initializePromise = checkDatabaseConnection();
  }

  await initializePromise;
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
