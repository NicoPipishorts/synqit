-- Add role column for account-level access
ALTER TABLE "users"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Restrict to supported account roles
ALTER TABLE "users"
ADD CONSTRAINT "users_role_check"
CHECK ("role" IN ('user', 'admin'));

-- Per-scope admin permissions for fine-grained read/write access
CREATE TABLE "user_admin_permissions" (
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_admin_permissions_pkey" PRIMARY KEY ("user_id","scope")
);

CREATE INDEX "idx_user_admin_permissions_user_id" ON "user_admin_permissions"("user_id");

ALTER TABLE "user_admin_permissions"
ADD CONSTRAINT "user_admin_permissions_access_level_check"
CHECK ("access_level" IN ('read', 'write'));

ALTER TABLE "user_admin_permissions"
ADD CONSTRAINT "user_admin_permissions_scope_check"
CHECK ("scope" IN ('dashboard', 'users', 'events', 'integrations', 'emails', 'analytics'));

ALTER TABLE "user_admin_permissions"
ADD CONSTRAINT "user_admin_permissions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
