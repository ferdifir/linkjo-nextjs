CREATE TABLE "whatsapp_outbound_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "target" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'baileys',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_outbound_messages_status_created_at_idx" ON "whatsapp_outbound_messages"("status", "created_at");
CREATE INDEX "whatsapp_outbound_messages_tenant_id_created_at_idx" ON "whatsapp_outbound_messages"("tenant_id", "created_at");

ALTER TABLE "whatsapp_outbound_messages"
ADD CONSTRAINT "whatsapp_outbound_messages_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
