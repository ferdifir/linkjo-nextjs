import { prisma } from '@/lib/prisma'
import { generateOTP } from '@/lib/auth'
import { sendWA } from '@/lib/fonnte'
import { randomUUID } from 'crypto'
import { normalizePhone } from '@/lib/validation'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { createOwnerVerificationIntent } from '@/lib/whatsapp-intents'

export async function POST(req: Request) {
  const body = await req.json()
  const phone = normalizePhone(body.phone)
  if (!phone) {
    return Response.json({ error: 'nomor WhatsApp tidak valid' }, { status: 400 })
  }

  const ipLimit = await checkRateLimit({ key: `otp:ip:${clientIp(req)}`, limit: 20, windowMs: 60 * 60 * 1000 })
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)

  const phoneLimit = await checkRateLimit({ key: `otp:phone:${phone}`, limit: 3, windowMs: 60 * 60 * 1000 })
  if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.resetAt)

  if (body.mode !== "otp") {
    await prisma.whatsappIntent.updateMany({
      where: { phoneExpected: phone, purpose: "VERIFY_OWNER_PHONE", consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })

    const intent = await createOwnerVerificationIntent(phone)
    return Response.json({ success: true, mode: "whatsapp", ...intent })
  }

  const count = await prisma.otpCode.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (count >= 3) {
    return Response.json({ error: 'terlalu banyak permintaan OTP, coba lagi nanti' }, { status: 429 })
  }

  await prisma.otpCode.updateMany({
    where: { phone, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  })

  const code = generateOTP()
  const otpId = randomUUID()
  await prisma.otpCode.create({
    data: { id: otpId, phone, code, expiresAt: new Date(Date.now() + 300000) },
  })

  const result = await sendWA(phone, `Kode OTP Linkjo kamu: ${code}. Berlaku 5 menit.`)
  if (!result.success) {
    console.error(`Gagal kirim OTP ke ${phone}: ${result.error}`)
    await prisma.otpCode.deleteMany({ where: { id: otpId } })
    return Response.json({ error: 'gagal mengirim OTP via WhatsApp' }, { status: 502 })
  }

  return Response.json({ success: true })
}
