import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname } from "path"
import { isFonnteReady } from "@/lib/fonnte"
import { logger, safeError } from "@/lib/logger"
import { whatsappProvider } from "@/lib/whatsapp-provider"

export type WhatsappRuntimeStatus = {
  provider: "fonnte" | "baileys"
  connected: boolean
  lastConnectedAt: string | null
  lastDisconnectedAt: string | null
  lastError: string | null
  phoneNumber: string | null
  updatedAt: string
}

export function whatsappStatusPath() {
  return process.env.WHATSAPP_STATUS_PATH ||
    (process.env.WHATSAPP_SHARED_DIR
      ? `${process.env.WHATSAPP_SHARED_DIR}/whatsapp-status.json`
      : "/tmp/linkjo-whatsapp-status.json")
}

export async function readWhatsappStatus(): Promise<WhatsappRuntimeStatus> {
  const provider = whatsappProvider()
  if (provider === "fonnte") {
    return {
      provider,
      connected: isFonnteReady(),
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
      phoneNumber: null,
      updatedAt: new Date().toISOString(),
    }
  }

  try {
    const raw = await readFile(whatsappStatusPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<WhatsappRuntimeStatus>
    return {
      provider: "baileys",
      connected: Boolean(parsed.connected),
      lastConnectedAt: parsed.lastConnectedAt ?? null,
      lastDisconnectedAt: parsed.lastDisconnectedAt ?? null,
      lastError: parsed.lastError ?? null,
      phoneNumber: parsed.phoneNumber ?? null,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    }
  } catch {
    return {
      provider: "baileys",
      connected: false,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: "status file not available",
      phoneNumber: null,
      updatedAt: new Date().toISOString(),
    }
  }
}

export async function writeWhatsappStatus(patch: Partial<WhatsappRuntimeStatus>) {
  const current = await readStatusFileOnly()
  const next: WhatsappRuntimeStatus = {
    provider: "baileys",
    connected: patch.connected ?? current.connected ?? false,
    lastConnectedAt: patch.lastConnectedAt ?? current.lastConnectedAt ?? null,
    lastDisconnectedAt: patch.lastDisconnectedAt ?? current.lastDisconnectedAt ?? null,
    lastError: patch.lastError ?? current.lastError ?? null,
    phoneNumber: patch.phoneNumber ?? current.phoneNumber ?? null,
    updatedAt: new Date().toISOString(),
  }

  const path = whatsappStatusPath()
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8")
  } catch (error) {
    logger.error({
      event: "whatsapp.status.write_failed",
      path,
      err: safeError(error),
    })
  }
}

async function readStatusFileOnly(): Promise<Partial<WhatsappRuntimeStatus>> {
  try {
    return JSON.parse(await readFile(whatsappStatusPath(), "utf8")) as Partial<WhatsappRuntimeStatus>
  } catch {
    return {}
  }
}
