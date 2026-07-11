ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "booking_hours" TEXT NOT NULL DEFAULT '';

ALTER TABLE "antrian"
  ADD COLUMN IF NOT EXISTS "queue_date" DATE;

UPDATE "antrian"
SET "queue_date" = ("created_at" AT TIME ZONE 'Asia/Jakarta')::date
WHERE "queue_date" IS NULL;

ALTER TABLE "antrian"
  ALTER COLUMN "queue_date" SET NOT NULL;

DROP INDEX IF EXISTS "antrian_tenant_id_no_antrian_key";

-- Renumber historical duplicates inside each tenant/day before enforcing daily uniqueness.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, queue_date
      ORDER BY created_at, id
    ) AS daily_no
  FROM antrian
)
UPDATE antrian a
SET no_antrian = ranked.daily_no
FROM ranked
WHERE a.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS "antrian_tenant_id_queue_date_no_antrian_key"
  ON "antrian"("tenant_id", "queue_date", "no_antrian");

DROP INDEX IF EXISTS "antrian_tenant_id_status_idx";

CREATE INDEX IF NOT EXISTS "antrian_tenant_id_queue_date_status_idx"
  ON "antrian"("tenant_id", "queue_date", "status");
