CREATE TABLE "user_preferences" (
  "user_id"    TEXT        NOT NULL,
  "theme"      TEXT,
  "locale"     TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
