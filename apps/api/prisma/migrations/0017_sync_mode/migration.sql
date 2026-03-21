ALTER TABLE "playlist_syncs"
ADD COLUMN "sync_mode" TEXT NOT NULL DEFAULT 'host_only';
