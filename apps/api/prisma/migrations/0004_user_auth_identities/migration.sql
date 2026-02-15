-- AlterTable
ALTER TABLE "users"
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_auth_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_auth_identities_user_id" ON "user_auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_identities_provider_provider_user_id_key" ON "user_auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_identities_user_id_provider_key" ON "user_auth_identities"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Backfill existing password users as explicit auth identities
INSERT INTO "user_auth_identities" (
    id,
    user_id,
    provider,
    provider_user_id,
    password_hash,
    created_at,
    updated_at
)
SELECT
    'password:' || id,
    id,
    'password',
    lower(email),
    password_hash,
    created_at,
    created_at
FROM "users"
WHERE password_hash IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;
