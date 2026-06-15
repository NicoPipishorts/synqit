-- DropIndex
DROP INDEX "idx_users_is_blocked";

-- AlterTable
ALTER TABLE "playlist_drafts" RENAME CONSTRAINT "event_drafts_pkey" TO "playlist_drafts_pkey";

-- AlterTable
ALTER TABLE "playlist_tracks" RENAME CONSTRAINT "event_tracks_pkey" TO "playlist_tracks_pkey";

-- AlterTable
ALTER TABLE "playlists" RENAME CONSTRAINT "events_pkey" TO "playlists_pkey";

-- CreateTable
CREATE TABLE "notification_runs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notification_runs_kind" ON "notification_runs"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "notification_runs_kind_period_key_key" ON "notification_runs"("kind", "period_key");

-- RenameForeignKey
ALTER TABLE "playlist_drafts" RENAME CONSTRAINT "event_drafts_host_user_id_fkey" TO "playlist_drafts_host_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "playlist_tracks" RENAME CONSTRAINT "event_tracks_event_id_fkey" TO "playlist_tracks_event_id_fkey";

-- RenameForeignKey
ALTER TABLE "playlists" RENAME CONSTRAINT "events_host_user_id_fkey" TO "playlists_host_user_id_fkey";

-- RenameIndex
ALTER INDEX "event_tracks_event_id_provider_track_id_key" RENAME TO "playlist_tracks_event_id_provider_track_id_key";

-- RenameIndex
ALTER INDEX "events_magic_link_token_key" RENAME TO "playlists_magic_link_token_key";
