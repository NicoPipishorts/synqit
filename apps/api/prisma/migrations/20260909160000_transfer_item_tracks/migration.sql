-- CreateTable
CREATE TABLE "transfer_item_tracks" (
    "id" TEXT NOT NULL,
    "transfer_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "source_provider_track_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL,
    "artwork_url" TEXT,
    "duration_ms" INTEGER,
    "status" TEXT NOT NULL,
    "destination_provider_track_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_item_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transfer_item_tracks_item_id" ON "transfer_item_tracks"("transfer_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_transfer_item_tracks_item_position" ON "transfer_item_tracks"("transfer_item_id", "position");

-- AddForeignKey
ALTER TABLE "transfer_item_tracks" ADD CONSTRAINT "transfer_item_tracks_transfer_item_id_fkey" FOREIGN KEY ("transfer_item_id") REFERENCES "transfer_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

