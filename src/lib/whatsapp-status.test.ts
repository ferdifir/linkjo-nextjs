import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/fonnte", () => ({
  isFonnteReady: vi.fn().mockReturnValue(true),
}))

import { readWhatsappStatus, writeWhatsappStatus } from "./whatsapp-status"

let dir = ""

describe("whatsapp status", () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "linkjo-wa-status-"))
    process.env.WHATSAPP_STATUS_PATH = join(dir, "status.json")
    delete process.env.WHATSAPP_PROVIDER
  })

  afterEach(async () => {
    delete process.env.WHATSAPP_STATUS_PATH
    delete process.env.WHATSAPP_PROVIDER
    await rm(dir, { recursive: true, force: true })
  })

  it("returns Fonnte readiness by default", async () => {
    await expect(readWhatsappStatus()).resolves.toMatchObject({
      provider: "fonnte",
      connected: true,
    })
  })

  it("reads Baileys status from the configured file", async () => {
    process.env.WHATSAPP_PROVIDER = "baileys"
    await writeFile(process.env.WHATSAPP_STATUS_PATH!, JSON.stringify({
      connected: true,
      lastConnectedAt: "2026-07-15T00:00:00.000Z",
      phoneNumber: "628123456789",
      updatedAt: "2026-07-15T00:01:00.000Z",
    }))

    await expect(readWhatsappStatus()).resolves.toEqual({
      provider: "baileys",
      connected: true,
      lastConnectedAt: "2026-07-15T00:00:00.000Z",
      lastDisconnectedAt: null,
      lastError: null,
      phoneNumber: "628123456789",
      updatedAt: "2026-07-15T00:01:00.000Z",
    })
  })

  it("writes Baileys status patches", async () => {
    process.env.WHATSAPP_PROVIDER = "baileys"

    await writeWhatsappStatus({
      connected: true,
      lastConnectedAt: "2026-07-15T00:00:00.000Z",
      phoneNumber: "628123456789",
    })

    await expect(readWhatsappStatus()).resolves.toMatchObject({
      provider: "baileys",
      connected: true,
      lastConnectedAt: "2026-07-15T00:00:00.000Z",
      phoneNumber: "628123456789",
      lastError: null,
    })
  })
})
