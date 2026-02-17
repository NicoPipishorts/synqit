CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "page_path" TEXT NOT NULL,
    "locale" TEXT,
    "source" TEXT NOT NULL,
    "referrer" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_analytics_events_created_at" ON "analytics_events"("created_at");
CREATE INDEX "idx_analytics_events_event_name" ON "analytics_events"("event_name");
CREATE INDEX "idx_analytics_events_target" ON "analytics_events"("target");
CREATE INDEX "idx_analytics_events_user_id" ON "analytics_events"("user_id");

ALTER TABLE "analytics_events"
ADD CONSTRAINT "analytics_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
