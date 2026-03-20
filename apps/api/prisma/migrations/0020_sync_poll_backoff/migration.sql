ALTER TABLE "playlist_syncs"
ADD COLUMN "next_poll_at" TIMESTAMPTZ(6),
ADD COLUMN "unchanged_poll_streak" INTEGER NOT NULL DEFAULT 0;
