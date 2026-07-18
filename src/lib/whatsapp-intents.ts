import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/validation"
import { getPublicAppUrl } from "@/lib/public-url"

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const TOKEN_LENGTH = 6
const TOKEN_PATTERN = "[A-HJ-NP-Z2-9]{6,10}"
const TOKEN_ONLY_PATTERN = new RegExp(`^${TOKEN_PATTERN}$`)
const TOKEN_MESSAGE_PATTERNS = [
  new RegExp(`^\\s*LINKJO\\s+(${TOKEN_PATTERN})\\b`),
  new RegExp(`\\bKODE\\s+(?:VERIFIKASI|LOGIN|MASUK)\\s*(?:SAYA\\s*)?[:#-]?\\s*(${TOKEN_PATTERN})\\b`),
  new RegExp(`\\b(?:VERIFIKASI|LOGIN|MASUK)\\s+(?:LINKJO\\s+)?(?:DENGAN\\s+)?KODE\\s*[:#-]?\\s*(${TOKEN_PATTERN})\\b`),
]

export function generateWhatsappIntentToken() {
  const bytes = randomBytes(TOKEN_LENGTH)
  let token = ""
  for (const byte of bytes) {
    token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]
  }
  return token
}

export function extractWhatsappIntentToken(message: string) {
  const upper = message.toUpperCase()
  for (const pattern of TOKEN_MESSAGE_PATTERNS) {
    const match = upper.match(pattern)
    if (match?.[1]) return match[1]
  }

  const trimmed = upper.trim()
  return TOKEN_ONLY_PATTERN.test(trimmed) ? trimmed : null
}

export function whatsappIntentMessage(token: string) {
  return `Halo Linkjo, saya ingin verifikasi nomor WhatsApp saya. Kode verifikasi: ${token}`
}

export function whatsappServicePhone() {
  return normalizePhone(
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
      process.env.WHATSAPP_NUMBER ||
      process.env.FONNTE_WHATSAPP_NUMBER ||
      "",
  )
}

export function whatsappIntentLink(token: string) {
  const servicePhone = whatsappServicePhone()
  const text = encodeURIComponent(whatsappIntentMessage(token))
  return servicePhone ? `https://wa.me/${servicePhone}?text=${text}` : `https://wa.me/?text=${text}`
}

export async function createOwnerVerificationIntent(phone: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateWhatsappIntentToken()
    try {
      const intent = await prisma.whatsappIntent.create({
        data: {
          token,
          purpose: "VERIFY_OWNER_PHONE",
          phoneExpected: phone,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          payload: { source: "auth" },
        },
        select: { id: true, token: true, expiresAt: true },
      })
      return {
        id: intent.id,
        contextCode: intent.token,
        message: whatsappIntentMessage(intent.token),
        waLink: whatsappIntentLink(intent.token),
        expiresAt: intent.expiresAt,
        appUrl: getPublicAppUrl(),
      }
    } catch (error) {
      if (attempt === 4) throw error
    }
  }
  throw new Error("gagal membuat kode verifikasi")
}

export async function consumeOwnerVerificationIntent(token: string, from: string) {
  const phone = normalizePhone(from)
  if (!phone) return { consumed: false, reason: "invalid_phone" as const }

  return prisma.$transaction(async (tx) => {
    const intent = await tx.whatsappIntent.findUnique({
      where: { token },
      select: {
        id: true,
        purpose: true,
        phoneExpected: true,
        expiresAt: true,
        consumedAt: true,
      },
    })

    if (!intent || intent.purpose !== "VERIFY_OWNER_PHONE") {
      return { consumed: false, reason: "not_found" as const }
    }
    if (intent.consumedAt) return { consumed: false, reason: "consumed" as const }
    if (intent.expiresAt <= new Date()) return { consumed: false, reason: "expired" as const }
    if (intent.phoneExpected && intent.phoneExpected !== phone) {
      return { consumed: false, reason: "phone_mismatch" as const }
    }

    const result = await tx.whatsappIntent.updateMany({
      where: { id: intent.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    if (result.count === 0) return { consumed: false, reason: "race" as const }

    return { consumed: true, phone }
  })
}
