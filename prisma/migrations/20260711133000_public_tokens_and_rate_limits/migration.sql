ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "public_token" TEXT;

UPDATE "bookings"
SET "public_token" = substr(
  md5(random()::text || clock_timestamp()::text || id::text) ||
  md5(tenant_id || random()::text || scheduled_at::text),
  1,
  48
)
WHERE "public_token" IS NULL OR "public_token" = '';

ALTER TABLE "bookings"
  ALTER COLUMN "public_token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_public_token_key"
  ON "bookings"("public_token");

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
