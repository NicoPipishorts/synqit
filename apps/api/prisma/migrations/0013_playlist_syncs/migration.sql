CREATE TABLE "playlist_syncs" (
    "id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_playlist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "track_count" INTEGER NOT NULL,
    "magic_link_token" TEXT NOT NULL,
    "magic_link_revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "playlist_syncs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlist_sync_imports" (
    "id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "recipient_provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "matched_count" INTEGER,
    "skipped_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "playlist_sync_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlist_syncs_magic_link_token_key" ON "playlist_syncs"("magic_link_token");
CREATE INDEX "idx_playlist_syncs_sender_user_id" ON "playlist_syncs"("sender_user_id");

CREATE UNIQUE INDEX "playlist_sync_imports_sync_id_recipient_user_id_key" ON "playlist_sync_imports"("sync_id", "recipient_user_id");
CREATE INDEX "idx_playlist_sync_imports_sync_id" ON "playlist_sync_imports"("sync_id");
CREATE INDEX "idx_playlist_sync_imports_recipient_user_id" ON "playlist_sync_imports"("recipient_user_id");

ALTER TABLE "playlist_syncs" ADD CONSTRAINT "playlist_syncs_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "playlist_sync_imports" ADD CONSTRAINT "playlist_sync_imports_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "playlist_syncs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "playlist_sync_imports" ADD CONSTRAINT "playlist_sync_imports_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
