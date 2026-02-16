CREATE TABLE "event_drafts" (
    "id" TEXT NOT NULL,
    "host_user_id" TEXT NOT NULL,
    "provider" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_event_drafts_host_user_id" ON "event_drafts"("host_user_id");

ALTER TABLE "event_drafts" ADD CONSTRAINT "event_drafts_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
