import { prisma } from '@/lib/prisma'
import { signToken, setTokenCookie } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { normalizePhone } from '@/lib/validation'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const payload = await req.json()
  const phone = normalizePhone(payload.phone)
  const code = typeof payload.code === 'string' ? payload.code.trim() : ''
  if (!phone || !code) {
    return Response.json({ error: 'phone and code required' }, { status: 400 })
  }

  const ipLimit = await checkRateLimit({ key: `otp-verify:ip:${clientIp(req)}`, limit: 30, windowMs: 60 * 60 * 1000 })
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)

  const phoneLimit = await checkRateLimit({ key: `otp-verify:phone:${phone}`, limit: 10, windowMs: 60 * 60 * 1000 })
  if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.resetAt)

  const otp = await prisma.otpCode.findFirst({
    where: { phone, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) {
    return Response.json({ error: 'kode OTP tidak valid atau sudah expired' }, { status: 401 })
  }
  if (otp.attempts >= 3) {
    return Response.json({ error: 'terlalu banyak percobaan, minta OTP baru' }, { status: 401 })
  }
  if (otp.code !== code) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return Response.json({ error: 'kode OTP salah' }, { status: 401 })
  }

  await prisma.otpCode.delete({ where: { id: otp.id } })

  let user = await prisma.user.findUnique({ where: { phone }, include: { tenant: true } })
  let needsSetup = false

  if (!user) {
    needsSetup = true
    const tenantId = randomUUID()
    const userId = randomUUID()

    await prisma.$transaction([
      prisma.tenant.create({ data: { id: tenantId, name: phone } }),
      prisma.user.create({ data: { id: userId, tenantId, phone, name: phone } }),
    ])

    user = await prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } })!
  } else if (!user.username) {
    needsSetup = true
  }

  if (!user) {
    return Response.json({ error: 'gagal membuat user' }, { status: 500 })
  }

  const token = await signToken({ user_id: user.id, tenant_id: user.tenantId, phone: user.phone })

  const body = {
    token,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username || '',
      name: user.name,
      tenant_id: user.tenantId,
      setup_completed: user.tenant.setupCompleted,
    },
    needs_setup: needsSetup,
  }

  const res = Response.json(body)
  setTokenCookie(res, token)
  return res
}
