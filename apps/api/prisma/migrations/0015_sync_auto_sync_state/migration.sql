ALTER TABLE "playlist_syncs"
  ADD COLUMN "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "last_source_fingerprint" TEXT,
  ADD COLUMN "last_polled_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_error" TEXT;

ALTER TABLE "playlist_sync_imports"
  ADD COLUMN "recipient_provider_playlist_id" TEXT,
  ADD COLUMN "last_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_error" TEXT;
