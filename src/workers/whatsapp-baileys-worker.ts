import "dotenv/config"

import QRCode from "qrcode"
import pino from "pino"
import type { WASocket } from "baileys"
import { logger, maskPhone, safeError } from "@/lib/logger"
import { parseBaileysMessage, jidForPhone } from "@/lib/baileys-message"
import { handleWhatsappInbound } from "@/lib/whatsapp-inbound"
import {
  claimPendingWhatsappMessages,
  markWhatsappMessageFailed,
  markWhatsappMessageSent,
} from "@/lib/whatsapp-outbox"
import { writeWhatsappStatus } from "@/lib/whatsapp-status"

const OUTBOX_POLL_MS = Number(process.env.WHATSAPP_OUTBOX_POLL_MS || 2000)
const OUTBOX_BATCH_SIZE = Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE || 10)

let socket: WASocket | null = null
let connected = false
let reconnecting = false
let stopping = false
let processingOutbox = false

async function main() {
  if (process.env.WHATSAPP_PROVIDER !== "baileys") {
    logger.info({
      event: "whatsapp.worker.skipped",
      reason: "provider_not_baileys",
      provider: process.env.WHATSAPP_PROVIDER || "fonnte",
    })
    return
  }

  await writeWhatsappStatus({
    connected: false,
    lastError: null,
  })

  await startSocket()
  setInterval(() => {
    void processOutbox()
  }, OUTBOX_POLL_MS)
}

async function startSocket() {
  if (stopping) return

  const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState: createMultiFileAuthState,
  } = await import("baileys")
  const authDir = authStateDir()
  const { state, saveCreds } = await createMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  logger.info({
    event: "whatsapp.worker.starting",
    provider: "baileys",
    auth_dir: authDir,
    version,
  })

  socket = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" }),
  })

  socket.ev.on("creds.update", saveCreds)

  socket.ev.on("connection.update", async (update) => {
    if (update.qr) {
      await logQr(update.qr)
      await writeWhatsappStatus({
        connected: false,
        lastError: "pairing required",
      })
    }

    if (update.connection === "open") {
      connected = true
      const phoneNumber = socket?.user?.id?.split(":")[0]?.split("@")[0] || null
      logger.info({
        event: "whatsapp.worker.connected",
        phone: maskPhone(phoneNumber),
      })
      await writeWhatsappStatus({
        connected: true,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
        phoneNumber,
      })
      void processOutbox()
    }

    if (update.connection === "close") {
      connected = false
      const error = update.lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined
      const statusCode = error?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      logger.warn({
        event: "whatsapp.worker.disconnected",
        status_code: statusCode,
        logged_out: loggedOut,
        err: error?.message,
      })
      await writeWhatsappStatus({
        connected: false,
        lastDisconnectedAt: new Date().toISOString(),
        lastError: error?.message || `disconnected: ${statusCode || "unknown"}`,
      })
      socket = null
      if (!loggedOut) await scheduleReconnect()
    }
  })

  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      const parsed = parseBaileysMessage(message)
      if (!parsed) {
        logger.info({
          event: "whatsapp.worker.message_ignored",
          remote_jid: message.key.remoteJid,
          from_me: message.key.fromMe,
          message_keys: message.message ? Object.keys(message.message) : [],
        })
        continue
      }

      logger.info({
        event: "whatsapp.worker.message_received",
        sender: maskPhone(parsed.from),
        message_length: parsed.text.length,
      })

      await handleWhatsappInbound({
        from: parsed.from,
        message: parsed.text,
        replyTarget: parsed.replyJid,
        source: "baileys_worker",
      })
    }
  })
}

async function processOutbox() {
  if (!connected || !socket || processingOutbox) return
  processingOutbox = true

  try {
    const rows = await claimPendingWhatsappMessages(OUTBOX_BATCH_SIZE)
    for (const row of rows) {
      const jid = jidForPhone(row.target)
      if (!jid) {
        await markWhatsappMessageFailed(row.id, new Error("invalid target phone"), row.attempts)
        continue
      }

      try {
        await socket.sendMessage(jid, { text: row.message })
        await markWhatsappMessageSent(row.id)
        logger.info({
          event: "whatsapp.outbox.sent",
          id: row.id,
          target: maskPhone(row.target),
          message_length: row.message.length,
        })
      } catch (error) {
        await markWhatsappMessageFailed(row.id, error, row.attempts)
        logger.warn({
          event: "whatsapp.outbox.send_failed",
          id: row.id,
          target: maskPhone(row.target),
          err: safeError(error),
        })
      }
    }
  } catch (error) {
    logger.error({
      event: "whatsapp.outbox.process_failed",
      err: safeError(error),
    })
  } finally {
    processingOutbox = false
  }
}

async function scheduleReconnect() {
  if (reconnecting || stopping) return
  reconnecting = true
  setTimeout(() => {
    reconnecting = false
    void startSocket()
  }, 5000)
}

async function logQr(qr: string) {
  logger.warn({
    event: "whatsapp.worker.qr_required",
    message: "Scan the QR code from PM2 logs to pair the global Linkjo WhatsApp number.",
  })
  try {
    const qrText = await QRCode.toString(qr, { type: "terminal", small: true })
    console.log(qrText)
  } catch (error) {
    logger.warn({
      event: "whatsapp.worker.qr_render_failed",
      err: safeError(error),
    })
  }
}

function authStateDir() {
  return process.env.WHATSAPP_BAILEYS_AUTH_DIR ||
    (process.env.WHATSAPP_SHARED_DIR
      ? `${process.env.WHATSAPP_SHARED_DIR}/baileys-auth`
      : ".baileys-auth")
}

async function shutdown(signal: string) {
  stopping = true
  logger.info({ event: "whatsapp.worker.stopping", signal })
  await writeWhatsappStatus({
    connected: false,
    lastDisconnectedAt: new Date().toISOString(),
    lastError: `worker stopped by ${signal}`,
  })
  socket?.end(undefined)
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

main().catch(async (error) => {
  logger.error({
    event: "whatsapp.worker.fatal",
    err: safeError(error),
  })
  await writeWhatsappStatus({
    connected: false,
    lastError: safeError(error).message,
  })
  process.exit(1)
})
