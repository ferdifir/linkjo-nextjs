-- Add typed statuses for queue and booking workflows.
DO $$ BEGIN
  CREATE TYPE "queue_status" AS ENUM ('menunggu', 'dipanggil', 'selesai', 'batal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'rescheduled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "antrian"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "antrian"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "antrian"
  ALTER COLUMN "status" TYPE "queue_status"
  USING CASE
    WHEN "status" IN ('menunggu', 'dipanggil', 'selesai', 'batal') THEN "status"::"queue_status"
    ELSE 'menunggu'::"queue_status"
  END;

ALTER TABLE "antrian"
  ALTER COLUMN "status" SET DEFAULT 'menunggu';

-- Older data may contain duplicate queue numbers because they were generated with max + 1.
-- Keep the earliest row for each tenant/number and renumber later duplicates to a tenant-local tail.
WITH duplicated AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id, no_antrian ORDER BY id) AS duplicate_rank,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS tenant_row_number
  FROM antrian
),
tenant_max AS (
  SELECT tenant_id, COALESCE(MAX(no_antrian), 0) AS max_no
  FROM antrian
  GROUP BY tenant_id
)
UPDATE antrian a
SET no_antrian = tenant_max.max_no + duplicated.tenant_row_number
FROM duplicated
JOIN tenant_max ON tenant_max.tenant_id = duplicated.tenant_id
WHERE a.id = duplicated.id
  AND duplicated.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "antrian_tenant_id_no_antrian_key"
  ON "antrian"("tenant_id", "no_antrian");

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" BIGSERIAL NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" "booking_status" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bookings_tenant_id_scheduled_at_idx"
  ON "bookings"("tenant_id", "scheduled_at");

CREATE INDEX IF NOT EXISTS "bookings_tenant_id_phone_idx"
  ON "bookings"("tenant_id", "phone");
