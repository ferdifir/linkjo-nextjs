import { handleInboundCustomerMessage } from "@/lib/ai-assistant"
import { auditEvent } from "@/lib/audit"
import { durationMs, logger, maskPhone, safeError } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { cleanText, normalizePhone, SLUG_PATTERN } from "@/lib/validation"
import { consumeOwnerVerificationIntent, extractWhatsappIntentToken } from "@/lib/whatsapp-intents"
import { sendWhatsappMessage } from "@/lib/whatsapp-provider"

export type WhatsappInboundSource = "fonnte_webhook" | "baileys_worker"

export type WhatsappInboundInput = {
  from: unknown
  message: unknown
  tenantSlug?: unknown
  replyTarget?: string
  source: WhatsappInboundSource
  requestId?: string
  ip?: string
  startedAt?: number
}

export async function handleWhatsappInbound(input: WhatsappInboundInput) {
  const startedAt = input.startedAt ?? Date.now()
  const tenantSlug = cleanText(input.tenantSlug, 50)
  const from = normalizePhone(input.from) || cleanText(input.from, 120)
  const phone = normalizePhone(input.from)
  const replyTarget = input.replyTarget || from
  const message = cleanText(input.message, 1000)

  if (!from || !message) {
    logger.warn({
      event: "whatsapp.inbound.invalid_payload",
      request_id: input.requestId,
      source: input.source,
      ip: input.ip,
      sender: maskPhone(String(input.from ?? "")),
      has_message: Boolean(input.message),
      duration_ms: durationMs(startedAt),
    })
    return { success: false, status: 400, error: "from and message required" }
  }

  logger.info({
    event: "whatsapp.inbound.received",
    request_id: input.requestId,
    source: input.source,
    ip: input.ip,
    sender: maskPhone(from),
    message_length: message.length,
    has_tenant_hint: Boolean(tenantSlug),
  })

  const intentToken = extractWhatsappIntentToken(message)
  if (intentToken && phone) {
    const result = await consumeOwnerVerificationIntent(intentToken, phone)
    if (result.consumed) {
      await auditEvent({
        actorType: "whatsapp",
        actorIdentifier: phone,
        action: "whatsapp.intent.consume",
        resourceType: "whatsapp_intent",
        metadata: { purpose: "VERIFY_OWNER_PHONE", source: input.source },
      })
      logger.info({
        event: "whatsapp.intent.consumed",
        request_id: input.requestId,
        source: input.source,
        sender: maskPhone(from),
        duration_ms: durationMs(startedAt),
      })
      return { success: true, handled: "intent" as const }
    }
    logger.info({
      event: "whatsapp.intent.not_consumed",
      request_id: input.requestId,
      source: input.source,
      sender: maskPhone(from),
      reason: result.reason,
    })
  }

  const tenant = await resolveWhatsappTenant({ tenantSlug, phone: from })
  if (!tenant) {
    const reply = fallbackReply(message)
    const sendResult = await sendWhatsappMessage(replyTarget, reply)
    logger.info({
      event: "whatsapp.tenant.unresolved",
      request_id: input.requestId,
      source: input.source,
      sender: maskPhone(from),
      has_tenant_hint: Boolean(tenantSlug),
      reply_sent: sendResult.success,
      send_error: sendResult.error,
      queued: sendResult.queued,
      duration_ms: durationMs(startedAt),
    })
    return { success: true, reply }
  }

  try {
    logger.info({
      event: "whatsapp.tenant.resolved",
      request_id: input.requestId,
      source: input.source,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
    })
    const result = await handleInboundCustomerMessage({ tenant, from, message, replyTarget: input.replyTarget })
    logger.info({
      event: "whatsapp.message.handled",
      request_id: input.requestId,
      source: input.source,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
      reply_length: result.reply.length,
      duration_ms: durationMs(startedAt),
    })
    return { success: true, reply: result.reply }
  } catch (error) {
    logger.error({
      event: "whatsapp.message.failed",
      request_id: input.requestId,
      source: input.source,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
      err: safeError(error),
      duration_ms: durationMs(startedAt),
    })
    return { success: false, status: 500, error: "failed to process message" }
  }
}

async function resolveWhatsappTenant({ tenantSlug, phone }: { tenantSlug: string; phone: string }) {
  if (tenantSlug && SLUG_PATTERN.test(tenantSlug)) {
    return prisma.tenant.findFirst({
      where: { slug: tenantSlug, setupCompleted: true },
      select: tenantSelect,
    })
  }

  const conversation = await prisma.whatsappConversationState.findFirst({
    where: { phone },
    orderBy: { lastInteractionAt: "desc" },
    select: {
      tenant: {
        select: tenantSelect,
      },
    },
  })

  if (!conversation?.tenant?.setupCompleted) return null
  return conversation.tenant
}

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  operationalHours: true,
  services: {
    where: { active: true },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { id: true, name: true, durationMinutes: true, price: true, active: true },
  },
  setupCompleted: true,
}

function fallbackReply(message: string) {
  const lower = message.toLowerCase()
  const asksAboutLinkjo = /\b(linkjo|ini apa|apa itu|siapa ini|fitur|harga|biaya|cara pakai|daftar)\b/.test(lower)

  if (asksAboutLinkjo) {
    return [
      "Halo, ini Linkjo.",
      "Linkjo membantu usaha mengelola antrean, booking, dan pesan pelanggan lewat WhatsApp.",
      "Untuk menghubungi bisnis tertentu, silakan mulai dari link bisnis Linkjo yang diberikan owner, misalnya linkjo.my.id/nama-bisnis.",
    ].join("\n\n")
  }

  return [
    "Saya belum tahu Anda sedang menghubungi bisnis yang mana.",
    "Silakan mulai dari link bisnis Linkjo yang diberikan owner, misalnya linkjo.my.id/nama-bisnis, supaya pesan Anda terhubung ke tenant yang benar.",
  ].join("\n\n")
}
