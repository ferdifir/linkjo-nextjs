import type { WAMessage } from "baileys"
import { normalizePhone } from "@/lib/validation"

export type ParsedBaileysMessage = {
  from: string
  text: string
  remoteJid: string
}

export function parseBaileysMessage(message: WAMessage): ParsedBaileysMessage | null {
  const remoteJid = message.key.remoteJid || ""
  if (!remoteJid || message.key.fromMe) return null
  if (remoteJid === "status@broadcast") return null
  if (remoteJid.endsWith("@g.us")) return null
  if (remoteJid.endsWith("@broadcast")) return null
  if (remoteJid.includes("@newsletter")) return null

  const text = extractMessageText(message)
  if (!text) return null

  const from = normalizePhone(remoteJid.split("@")[0])
  if (!from) return null

  return { from, text, remoteJid }
}

export function jidForPhone(phone: string) {
  const normalized = normalizePhone(phone)
  return normalized ? `${normalized}@s.whatsapp.net` : null
}

function extractMessageText(message: WAMessage) {
  const content = message.message
  if (!content) return ""

  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    ""

  return text.trim()
}
