ALTER TABLE "users"
  ADD COLUMN "account_state" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "is_test_account" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletion_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN "deletion_scheduled_for" TIMESTAMPTZ(6),
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN "deletion_reason" TEXT,
  ADD COLUMN "test_reset_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_users_account_state" ON "users"("account_state");
CREATE INDEX "idx_users_deletion_scheduled_for" ON "users"("deletion_scheduled_for");
CREATE INDEX "idx_users_is_test_account" ON "users"("is_test_account");

CREATE TABLE "admin_audit_logs" (
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
);

CREATE INDEX "idx_admin_audit_logs_action" ON "admin_audit_logs"("action");
CREATE INDEX "idx_admin_audit_logs_created_at" ON "admin_audit_logs"("created_at");
CREATE INDEX "idx_admin_audit_logs_target_user_id" ON "admin_audit_logs"("target_user_id");
