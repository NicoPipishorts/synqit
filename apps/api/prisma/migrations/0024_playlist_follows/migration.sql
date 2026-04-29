CREATE TABLE "playlist_follows" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "playlist_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlist_follows_event_id_user_id_key"
ON "playlist_follows"("event_id", "user_id");

CREATE INDEX "idx_playlist_follows_event_id"
ON "playlist_follows"("event_id");

CREATE INDEX "idx_playlist_follows_user_id"
ON "playlist_follows"("user_id");

ALTER TABLE "playlist_follows"
ADD CONSTRAINT "playlist_follows_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "playlist_follows"
ADD CONSTRAINT "playlist_follows_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
