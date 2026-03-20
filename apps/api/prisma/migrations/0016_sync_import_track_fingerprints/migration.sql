ALTER TABLE "playlist_sync_imports"
ADD COLUMN "synced_source_track_fingerprints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
