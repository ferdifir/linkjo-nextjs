-- CreateEnum
CREATE TYPE "whatsapp_intent_purpose" AS ENUM (
    'VERIFY_OWNER_PHONE',
    'VERIFY_CUSTOMER_PHONE',
    'JOIN_QUEUE',
    'CREATE_BOOKING',
    'MANAGE_BOOKING'
);

-- CreateTable
CREATE TABLE "whatsapp_intents" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tenant_id" TEXT,
    "purpose" "whatsapp_intent_purpose" NOT NULL,
    "phone_expected" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversation_states" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pending_intent" TEXT,
    "pending_service_id" TEXT,
    "pending_scheduled_at" TIMESTAMP(3),
    "pending_customer_name" TEXT,
    "pending_booking_id" BIGINT,
    "pending_booking_token" TEXT,
    "last_mentioned_service_id" TEXT,
    "last_booking_id" BIGINT,
    "last_queue_id" BIGINT,
    "last_interaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversation_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_intents_token_key" ON "whatsapp_intents"("token");

-- CreateIndex
CREATE INDEX "whatsapp_intents_tenant_id_idx" ON "whatsapp_intents"("tenant_id");

-- CreateIndex
CREATE INDEX "whatsapp_intents_phone_expected_idx" ON "whatsapp_intents"("phone_expected");

-- CreateIndex
CREATE INDEX "whatsapp_intents_expires_at_idx" ON "whatsapp_intents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversation_states_tenant_id_phone_key" ON "whatsapp_conversation_states"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "whatsapp_conversation_states_tenant_id_last_interaction_at_idx" ON "whatsapp_conversation_states"("tenant_id", "last_interaction_at");

-- AddForeignKey
ALTER TABLE "whatsapp_intents" ADD CONSTRAINT "whatsapp_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_states" ADD CONSTRAINT "whatsapp_conversation_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
