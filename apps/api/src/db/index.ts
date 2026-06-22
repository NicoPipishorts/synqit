import { Pool } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://synqit:synqit@localhost:5435/synqit';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

const checkDatabaseConnection = async (): Promise<void> => {
  await pool.query('SELECT 1');
};

const ensureAccountLifecycleSchema = async (): Promise<void> => {
  await pool.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "account_state" TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "is_test_account" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deletion_requested_at" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "deletion_scheduled_for" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6),
      ADD COLUMN IF NOT EXISTS "deletion_reason" TEXT,
      ADD COLUMN IF NOT EXISTS "test_reset_at" TIMESTAMPTZ(6)
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_users_account_state" ON "users"("account_state")',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_users_deletion_scheduled_for" ON "users"("deletion_scheduled_for")',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_users_is_test_account" ON "users"("is_test_account")',
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
      "id" TEXT NOT NULL,
      "actor_user_id" TEXT,
      "actor_email" TEXT,
      "target_user_id" TEXT,
      "target_email" TEXT,
      "action" TEXT NOT NULL,
      "reason" TEXT,
      "metadata_json" JSONB,
      "created_at" TIMESTAMPTZ(6) NOT NULL,
      CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_action" ON "admin_audit_logs"("action")',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_created_at" ON "admin_audit_logs"("created_at")',
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_target_user_id" ON "admin_audit_logs"("target_user_id")',
  );
};

let initializePromise: Promise<void> | null = null;

export const initializeDatabase = async (): Promise<void> => {
  if (!initializePromise) {
    initializePromise = (async () => {
      await checkDatabaseConnection();
      await ensureAccountLifecycleSchema();
    })();
  }

  await initializePromise;
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
