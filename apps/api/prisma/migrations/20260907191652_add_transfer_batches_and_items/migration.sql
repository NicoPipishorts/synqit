-- CreateTable
CREATE TABLE "transfer_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_provider" TEXT NOT NULL,
    "destination_provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "transfer_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "provider_playlist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "track_count" INTEGER,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sync_id" TEXT,
    "matched_count" INTEGER,
    "skipped_count" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transfer_batches_user_id" ON "transfer_batches"("user_id");

-- CreateIndex
CREATE INDEX "idx_transfer_batches_status" ON "transfer_batches"("status");

-- CreateIndex
CREATE INDEX "idx_transfer_items_batch_id" ON "transfer_items"("batch_id");

-- CreateIndex
CREATE INDEX "idx_transfer_items_status" ON "transfer_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_transfer_items_batch_playlist" ON "transfer_items"("batch_id", "provider_playlist_id");

-- AddForeignKey
ALTER TABLE "transfer_batches" ADD CONSTRAINT "transfer_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "transfer_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "playlist_syncs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
