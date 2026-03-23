CREATE TABLE "registration_invite_tokens" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_preview" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "used_by_user_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),

  CONSTRAINT "registration_invite_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_invite_tokens_token_hash_key"
  ON "registration_invite_tokens"("token_hash");

CREATE INDEX "idx_registration_invite_tokens_created_by_user_id"
  ON "registration_invite_tokens"("created_by_user_id");

CREATE INDEX "idx_registration_invite_tokens_used_by_user_id"
  ON "registration_invite_tokens"("used_by_user_id");

ALTER TABLE "registration_invite_tokens"
  ADD CONSTRAINT "registration_invite_tokens_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "registration_invite_tokens"
  ADD CONSTRAINT "registration_invite_tokens_used_by_user_id_fkey"
  FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
