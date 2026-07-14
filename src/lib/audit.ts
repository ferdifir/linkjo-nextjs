import { prisma } from "@/lib/prisma"
import { logger, maskPhone, safeError } from "@/lib/logger"

type AuditMetadata = Record<string, string | number | boolean | null | undefined>

type AuditEventInput = {
  tenantId?: string | null
  actorType: "owner" | "customer" | "whatsapp" | "agent" | "system"
  actorIdentifier?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | number | bigint | null
  metadata?: AuditMetadata
}

export async function auditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId || null,
        actorType: input.actorType,
        actorIdentifier: input.actorIdentifier || null,
        action: input.action,
        resourceType: input.resourceType || null,
        resourceId: input.resourceId === null || input.resourceId === undefined ? null : input.resourceId.toString(),
        metadata: compactMetadata(input.metadata || {}),
      },
    })
  } catch (error) {
    logger.error({
      event: "audit.write_failed",
      tenant_id: input.tenantId,
      actor_type: input.actorType,
      actor_identifier: input.actorType === "customer" || input.actorType === "whatsapp"
        ? maskPhone(input.actorIdentifier || "")
        : input.actorIdentifier,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId?.toString(),
      err: safeError(error),
    })
  }
}

function compactMetadata(metadata: AuditMetadata) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
}
