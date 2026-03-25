CREATE TABLE "playlist_sync_track_activity" (
  "id" TEXT NOT NULL,
  "sync_id" TEXT NOT NULL,
  "track_fingerprint" TEXT NOT NULL,
  "provider_track_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "album" TEXT NOT NULL,
  "artwork_url" TEXT,
  "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "playlist_sync_track_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlist_sync_track_activity_sync_id_track_fingerprint_key"
ON "playlist_sync_track_activity"("sync_id", "track_fingerprint");

CREATE INDEX "idx_playlist_sync_track_activity_sync_id"
ON "playlist_sync_track_activity"("sync_id");

CREATE INDEX "idx_playlist_sync_track_activity_sync_id_first_seen_at"
ON "playlist_sync_track_activity"("sync_id", "first_seen_at");

ALTER TABLE "playlist_sync_track_activity"
ADD CONSTRAINT "playlist_sync_track_activity_sync_id_fkey"
FOREIGN KEY ("sync_id") REFERENCES "playlist_syncs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
