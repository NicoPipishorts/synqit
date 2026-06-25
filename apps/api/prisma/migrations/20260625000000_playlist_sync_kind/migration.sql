ALTER TABLE "playlist_syncs"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'shared';

-- Backfill: any sync that has an import addressed to its own sender is a
-- one-time transfer (the user moved a playlist into their own other library),
-- not a shared/synced list.
UPDATE "playlist_syncs" AS ps
SET "kind" = 'transfer'
WHERE EXISTS (
  SELECT 1
  FROM "playlist_sync_imports" AS i
  WHERE i."sync_id" = ps."id"
    AND i."recipient_user_id" = ps."sender_user_id"
);

CREATE INDEX "idx_playlist_syncs_kind" ON "playlist_syncs"("kind");
