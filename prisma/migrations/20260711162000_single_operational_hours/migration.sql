ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "operational_hours" TEXT NOT NULL DEFAULT '';

UPDATE "tenants"
SET "operational_hours" = CASE
  WHEN COALESCE("booking_hours", '') <> '' THEN "booking_hours"
  ELSE ''
END;

ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "business_hours",
  DROP COLUMN IF EXISTS "booking_hours";
