-- CreateTable
CREATE TABLE "provider_api_usage" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "unit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_provider_api_usage_day" ON "provider_api_usage"("day");

-- CreateIndex
CREATE INDEX "idx_provider_api_usage_provider" ON "provider_api_usage"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_provider_api_usage_bucket" ON "provider_api_usage"("day", "provider", "domain", "operation");

