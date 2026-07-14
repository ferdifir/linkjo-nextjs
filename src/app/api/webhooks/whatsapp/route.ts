import { handleInboundCustomerMessage } from "@/lib/ai-assistant"
import { prisma } from "@/lib/prisma"
import { cleanText, normalizePhone, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"
import { consumeOwnerVerificationIntent, extractWhatsappIntentToken } from "@/lib/whatsapp-intents"
import { durationMs, logger, maskPhone, requestIdFrom, safeError } from "@/lib/logger"
import { auditEvent } from "@/lib/audit"
import { sendWA } from "@/lib/fonnte"

export async function POST(req: Request) {
  const startedAt = Date.now()
  const requestId = requestIdFrom(req)
  const url = new URL(req.url)
  const ip = clientIp(req)
  const secret = process.env.WA_WEBHOOK_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    logger.error({
      event: "whatsapp.webhook.misconfigured",
      request_id: requestId,
      ip,
      reason: "missing_webhook_secret",
    })
    return Response.json({ error: "WA_WEBHOOK_SECRET must be configured" }, { status: 500 })
  }
  const providedSecret = req.headers.get("x-webhook-secret") || url.searchParams.get("secret")
  if (secret && providedSecret !== secret) {
    logger.warn({
      event: "whatsapp.webhook.unauthorized",
      request_id: requestId,
      ip,
      has_secret: Boolean(providedSecret),
      duration_ms: durationMs(startedAt),
    })
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ipLimit = await checkRateLimit({ key: `wa-webhook:ip:${ip}`, limit: 120, windowMs: 60 * 1000 })
  if (!ipLimit.allowed) {
    logger.warn({
      event: "whatsapp.webhook.rate_limited",
      request_id: requestId,
      ip,
      reset_at: ipLimit.resetAt.toISOString(),
      duration_ms: durationMs(startedAt),
    })
    return rateLimitResponse(ipLimit.resetAt)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (error) {
    logger.warn({
      event: "whatsapp.webhook.invalid_json",
      request_id: requestId,
      ip,
      err: safeError(error),
      duration_ms: durationMs(startedAt),
    })
    return Response.json({ error: "invalid json" }, { status: 400 })
  }
  const tenantSlug = cleanText(
    body.tenant_slug ?? body.tenantSlug ?? body.slug,
    50,
  )
  const from = normalizePhone(body.from ?? body.sender ?? body.phone ?? body.whatsapp)
  const message = cleanText(body.message ?? body.text ?? body.body, 1000)

  if (!from || !message) {
    logger.warn({
      event: "whatsapp.webhook.invalid_payload",
      request_id: requestId,
      ip,
      sender: maskPhone(String(body.from ?? body.sender ?? body.phone ?? body.whatsapp ?? "")),
      has_message: Boolean(body.message ?? body.text ?? body.body),
      duration_ms: durationMs(startedAt),
    })
    return Response.json({ error: "from and message required" }, { status: 400 })
  }

  logger.info({
    event: "whatsapp.webhook.received",
    request_id: requestId,
    ip,
    sender: maskPhone(from),
    message_length: message.length,
    has_tenant_hint: Boolean(tenantSlug),
  })

  const intentToken = extractWhatsappIntentToken(message)
  if (intentToken) {
    const result = await consumeOwnerVerificationIntent(intentToken, from)
    if (result.consumed) {
      await auditEvent({
        actorType: "whatsapp",
        actorIdentifier: from,
        action: "whatsapp.intent.consume",
        resourceType: "whatsapp_intent",
        metadata: { purpose: "VERIFY_OWNER_PHONE" },
      })
      logger.info({
        event: "whatsapp.intent.consumed",
        request_id: requestId,
        sender: maskPhone(from),
        duration_ms: durationMs(startedAt),
      })
      return Response.json({ success: true, handled: "intent" })
    }
    logger.info({
      event: "whatsapp.intent.not_consumed",
      request_id: requestId,
      sender: maskPhone(from),
      reason: result.reason,
    })
  }

  const tenant = await resolveWebhookTenant({ tenantSlug, phone: from })
  if (!tenant) {
    const reply = fallbackReply(message)
    const sendResult = await sendWA(from, reply)
    logger.info({
      event: "whatsapp.tenant.unresolved",
      request_id: requestId,
      sender: maskPhone(from),
      has_tenant_hint: Boolean(tenantSlug),
      reply_sent: sendResult.success,
      send_error: sendResult.error,
      duration_ms: durationMs(startedAt),
    })
    return Response.json({
      success: true,
      reply,
    })
  }

  try {
    logger.info({
      event: "whatsapp.tenant.resolved",
      request_id: requestId,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
    })
    const result = await handleInboundCustomerMessage({ tenant, from, message })
    logger.info({
      event: "whatsapp.message.handled",
      request_id: requestId,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
      reply_length: result.reply.length,
      duration_ms: durationMs(startedAt),
    })
    return Response.json({ success: true, reply: result.reply })
  } catch (error) {
    logger.error({
      event: "whatsapp.message.failed",
      request_id: requestId,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      sender: maskPhone(from),
      err: safeError(error),
      duration_ms: durationMs(startedAt),
    })
    return Response.json({ error: "failed to process message" }, { status: 500 })
  }
}

async function resolveWebhookTenant({ tenantSlug, phone }: { tenantSlug: string; phone: string }) {
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
