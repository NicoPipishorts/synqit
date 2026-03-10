ALTER TABLE "users"
ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "blocked_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_users_is_blocked" ON "users"("is_blocked");
