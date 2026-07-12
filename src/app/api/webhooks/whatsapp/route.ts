import { handleInboundCustomerMessage } from "@/lib/ai-assistant"
import { prisma } from "@/lib/prisma"
import { cleanText, normalizePhone, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.WA_WEBHOOK_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    return Response.json({ error: "WA_WEBHOOK_SECRET must be configured" }, { status: 500 })
  }
  const providedSecret = req.headers.get("x-webhook-secret") || url.searchParams.get("secret")
  if (secret && providedSecret !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ipLimit = await checkRateLimit({ key: `wa-webhook:ip:${clientIp(req)}`, limit: 120, windowMs: 60 * 1000 })
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)

  const body = await req.json()
  const tenantSlug = cleanText(
    body.tenant_slug ?? body.tenantSlug ?? body.slug ?? url.searchParams.get("tenant"),
    50,
  )
  const from = normalizePhone(body.from ?? body.sender ?? body.phone ?? body.whatsapp)
  const message = cleanText(body.message ?? body.text ?? body.body, 1000)

  if (!tenantSlug || !SLUG_PATTERN.test(tenantSlug)) {
    return Response.json({ error: "tenant_slug required" }, { status: 400 })
  }
  if (!from || !message) {
    return Response.json({ error: "from and message required" }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      operationalHours: true,
      services: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, durationMinutes: true, price: true, active: true },
      },
      setupCompleted: true,
    },
  })

  if (!tenant || !tenant.setupCompleted) {
    return Response.json({ error: "tenant not found" }, { status: 404 })
  }

  const result = await handleInboundCustomerMessage({ tenant, from, message })
  return Response.json({ success: true, reply: result.reply })
}
