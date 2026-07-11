CREATE TABLE "services" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "price" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "services_tenant_id_active_sort_order_idx"
  ON "services"("tenant_id", "active", "sort_order");

INSERT INTO "services" ("id", "tenant_id", "name", "sort_order")
SELECT
  'svc_' || substr(md5(t.id || ':' || row_number() OVER (PARTITION BY t.id ORDER BY ordinality)::text || ':' || service_name), 1, 24),
  t.id,
  service_name,
  row_number() OVER (PARTITION BY t.id ORDER BY ordinality) - 1
FROM tenants t
CROSS JOIN LATERAL regexp_split_to_table(COALESCE(t.services, ''), E'[,\\n]') WITH ORDINALITY AS split(service_name_raw, ordinality)
CROSS JOIN LATERAL (SELECT trim(split.service_name_raw) AS service_name) cleaned
WHERE service_name <> '';

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "service_id" TEXT,
  ADD COLUMN IF NOT EXISTS "service_duration_minutes" INTEGER NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS "bookings_tenant_id_service_id_idx"
  ON "bookings"("tenant_id", "service_id");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "services";
