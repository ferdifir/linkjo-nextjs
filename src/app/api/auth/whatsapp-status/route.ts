import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { signToken, setTokenCookie } from "@/lib/auth"
import { displayName } from "@/lib/display-name"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const payload = await req.json()
  const intentId = typeof payload.intent_id === "string" ? payload.intent_id.trim() : ""
  if (!intentId) {
    return Response.json({ error: "intent_id required" }, { status: 400 })
  }

  const ipLimit = await checkRateLimit({ key: `wa-auth-status:ip:${clientIp(req)}`, limit: 60, windowMs: 60 * 1000 })
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)

  const intent = await prisma.whatsappIntent.findFirst({
    where: { id: intentId, purpose: "VERIFY_OWNER_PHONE" },
    select: {
      id: true,
      phoneExpected: true,
      expiresAt: true,
      consumedAt: true,
    },
  })

  if (!intent) {
    return Response.json({ error: "verifikasi tidak ditemukan" }, { status: 404 })
  }
  if (!intent.consumedAt && intent.expiresAt <= new Date()) {
    return Response.json({ status: "expired" })
  }
  if (!intent.consumedAt) {
    return Response.json({ status: "pending" })
  }
  if (!intent.phoneExpected) {
    return Response.json({ error: "nomor verifikasi tidak valid" }, { status: 400 })
  }

  let user = await prisma.user.findUnique({
    where: { phone: intent.phoneExpected },
    include: { tenant: true },
  })
  let needsSetup = false

  if (!user) {
    needsSetup = true
    const tenantId = randomUUID()
    const userId = randomUUID()

    await prisma.$transaction([
      prisma.tenant.create({ data: { id: tenantId, name: intent.phoneExpected } }),
      prisma.user.create({ data: { id: userId, tenantId, phone: intent.phoneExpected, name: "" } }),
    ])

    user = await prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } })
  } else if (!user.username) {
    needsSetup = true
  }

  if (!user) {
    return Response.json({ error: "gagal membuat user" }, { status: 500 })
  }

  const token = await signToken({ user_id: user.id, tenant_id: user.tenantId, phone: user.phone })
  const res = Response.json({
    status: "verified",
    token,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username || "",
      name: displayName(user.name, user.phone),
      tenant_id: user.tenantId,
      setup_completed: user.tenant.setupCompleted,
    },
    needs_setup: needsSetup,
  })
  setTokenCookie(res, token)
  return res
}
