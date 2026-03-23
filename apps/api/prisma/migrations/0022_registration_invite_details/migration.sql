ALTER TABLE "registration_invite_tokens"
  ADD COLUMN "invited_email" TEXT,
  ADD COLUMN "locale" TEXT,
  ADD COLUMN "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_sent_at" TIMESTAMPTZ(6);
