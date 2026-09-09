-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
