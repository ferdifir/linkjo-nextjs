import type { WAMessage } from "baileys"
import { normalizePhone } from "@/lib/validation"

export type ParsedBaileysMessage = {
  from: string
  text: string
  remoteJid: string
  replyJid: string
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

  const from = normalizePhone(message.key.remoteJidAlt?.split("@")[0]) ||
    normalizePhone(message.key.remoteJidUsername || "") ||
    normalizePhone(remoteJid.split("@")[0]) ||
    remoteJid

  return { from, text, remoteJid, replyJid: remoteJid }
}

export function jidForPhone(phone: string) {
  if (phone.includes("@") && !phone.endsWith("@g.us") && phone !== "status@broadcast") return phone
  const normalized = normalizePhone(phone)
  return normalized ? `${normalized}@s.whatsapp.net` : null
}

function extractMessageText(message: WAMessage) {
  const content = unwrapMessageContent(message.message)
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

type BaileysMessageContent = NonNullable<WAMessage["message"]>

function unwrapMessageContent(content: WAMessage["message"]): BaileysMessageContent | null {
  if (!content) return null

  const wrapped =
    content.ephemeralMessage?.message ||
    content.viewOnceMessage?.message ||
    content.viewOnceMessageV2?.message ||
    content.viewOnceMessageV2Extension?.message ||
    content.documentWithCaptionMessage?.message ||
    null

  return wrapped ? unwrapMessageContent(wrapped) : content
}
