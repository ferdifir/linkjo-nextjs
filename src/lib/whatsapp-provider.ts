import { sendWA } from "@/lib/fonnte"
import { logger, maskPhone } from "@/lib/logger"
import { enqueueWhatsappMessage } from "@/lib/whatsapp-outbox"

export type WhatsappProvider = "fonnte" | "baileys"

export type SendWhatsappOptions = {
  typing?: boolean
  countryCode?: string
  tenantId?: string | null
}

export function whatsappProvider(): WhatsappProvider {
  return process.env.WHATSAPP_PROVIDER === "baileys" ? "baileys" : "fonnte"
}

export async function sendWhatsappMessage(
  target: string,
  message: string,
  options?: SendWhatsappOptions,
): Promise<{ success: boolean; error?: string; queued?: boolean; id?: string }> {
  const provider = whatsappProvider()

  if (provider === "fonnte") {
    return sendWA(target, message, options)
  }

  if (process.env.E2E_SKIP_NOTIFICATIONS === "1") {
    logger.debug({
      event: "whatsapp.send",
      provider,
      target: maskPhone(target),
      message_length: message.length,
      status: "skipped",
      reason: "e2e_skip_notifications",
    })
    return { success: true }
  }

  const row = await enqueueWhatsappMessage({
    target,
    message,
    tenantId: options?.tenantId,
    provider,
  })
  return { success: true, queued: true, id: row.id }
}
