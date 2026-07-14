import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"
import { durationMs, logger, requestIdFrom, safeError } from "@/lib/logger"
import { handleWhatsappInbound } from "@/lib/whatsapp-inbound"

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
  const result = await handleWhatsappInbound({
    from: body.from ?? body.sender ?? body.phone ?? body.whatsapp,
    message: body.message ?? body.text ?? body.body,
    tenantSlug: body.tenant_slug ?? body.tenantSlug ?? body.slug,
    source: "fonnte_webhook",
    requestId,
    ip,
    startedAt,
  })

  if (!result.success) {
    return Response.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return Response.json(result)
}
