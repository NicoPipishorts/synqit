-- CreateTable
CREATE TABLE "external_imports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_playlist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "recipient_provider" TEXT NOT NULL,
    "recipient_provider_playlist_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "external_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_external_imports_user_id" ON "external_imports"("user_id");

-- CreateIndex
CREATE INDEX "idx_external_imports_status" ON "external_imports"("status");

-- AddForeignKey
ALTER TABLE "external_imports" ADD CONSTRAINT "external_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

