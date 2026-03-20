ALTER TABLE "playlist_syncs"
ADD COLUMN "last_source_snapshot_id" TEXT;

ALTER TABLE "playlist_sync_imports"
ADD COLUMN "last_recipient_snapshot_id" TEXT;
