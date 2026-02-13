import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const loadEnvFileIfPresent = (filePath) => {
  try {
    process.loadEnvFile(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
};

loadEnvFileIfPresent(resolve(process.cwd(), '.env.local'));
loadEnvFileIfPresent(resolve(process.cwd(), '.env'));

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://synqit:synqit@localhost:5435/synqit';
const pool = new Pool({
  connectionString: databaseUrl,
});

const formatCount = async (tableName) => {
  const result = await pool.query(`SELECT COUNT(*)::text AS count FROM ${tableName}`);
  const count = Number(result.rows[0]?.count ?? '0');
  return `${tableName}: ${count}`;
};

const run = async () => {
  const counts = await Promise.all([
    formatCount('users'),
    formatCount('refresh_tokens'),
    formatCount('integrations'),
    formatCount('oauth_states'),
    formatCount('events'),
    formatCount('event_tracks'),
  ]);

  console.log('Synqit DB row counts');
  for (const line of counts) {
    console.log(`- ${line}`);
  }
};

run()
  .catch((error) => {
    console.error('db:check failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
