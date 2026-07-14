import { prisma } from "@/lib/prisma"
import { logger, maskPhone, safeError } from "@/lib/logger"

const MAX_ATTEMPTS = 5

export async function enqueueWhatsappMessage(input: {
  target: string
  message: string
  tenantId?: string | null
  provider?: string
}) {
  const row = await prisma.whatsappOutboundMessage.create({
    data: {
      tenantId: input.tenantId ?? null,
      target: input.target,
      message: input.message,
      provider: input.provider ?? "baileys",
    },
    select: { id: true },
  })

  logger.info({
    event: "whatsapp.outbox.enqueue",
    id: row.id,
    provider: input.provider ?? "baileys",
    target: maskPhone(input.target),
    message_length: input.message.length,
  })

  return row
}

export async function claimPendingWhatsappMessages(limit = 10) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.whatsappOutboundMessage.findMany({
      where: {
        provider: "baileys",
        status: "pending",
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, target: true, message: true, attempts: true },
    })

    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    await tx.whatsappOutboundMessage.updateMany({
      where: { id: { in: ids }, status: "pending" },
      data: { status: "sending", lockedAt: new Date() },
    })

    return rows
  })
}

export async function markWhatsappMessageSent(id: string) {
  await prisma.whatsappOutboundMessage.update({
    where: { id },
    data: {
      status: "sent",
      sentAt: new Date(),
      lastError: null,
    },
  })
}

export async function markWhatsappMessageFailed(id: string, error: unknown, attempts: number) {
  const finalFailure = attempts + 1 >= MAX_ATTEMPTS
  await prisma.whatsappOutboundMessage.update({
    where: { id },
    data: {
      status: finalFailure ? "failed" : "pending",
      attempts: { increment: 1 },
      lastError: safeError(error).message,
      lockedAt: null,
    },
  })
}
