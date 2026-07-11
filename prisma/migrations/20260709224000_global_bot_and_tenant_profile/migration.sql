-- Drop per-tenant WhatsApp session storage.
DROP TABLE IF EXISTS "wa_sessions";

-- Remove per-tenant bot/provider configuration.
ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "groq_api_key",
  DROP COLUMN IF EXISTS "persona";

-- Add tenant business profile used for onboarding and dynamic AI prompts.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "business_hours" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "services" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "setup_completed" BOOLEAN NOT NULL DEFAULT false;
