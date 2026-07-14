import { beforeEach, describe, expect, it, vi } from "vitest"

const fonnteMock = vi.hoisted(() => ({
  sendWA: vi.fn(),
}))

const outboxMock = vi.hoisted(() => ({
  enqueueWhatsappMessage: vi.fn(),
}))

vi.mock("@/lib/fonnte", () => fonnteMock)
vi.mock("@/lib/whatsapp-outbox", () => outboxMock)

import { sendWhatsappMessage, whatsappProvider } from "./whatsapp-provider"

describe("whatsapp provider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.WHATSAPP_PROVIDER
    delete process.env.E2E_SKIP_NOTIFICATIONS
    fonnteMock.sendWA.mockResolvedValue({ success: true })
    outboxMock.enqueueWhatsappMessage.mockResolvedValue({ id: "out_1" })
  })

  it("defaults to Fonnte", async () => {
    expect(whatsappProvider()).toBe("fonnte")

    await sendWhatsappMessage("628123456789", "halo")

    expect(fonnteMock.sendWA).toHaveBeenCalledWith("628123456789", "halo", undefined)
    expect(outboxMock.enqueueWhatsappMessage).not.toHaveBeenCalled()
  })

  it("enqueues messages when Baileys is selected", async () => {
    process.env.WHATSAPP_PROVIDER = "baileys"

    const result = await sendWhatsappMessage("628123456789", "halo", { tenantId: "tenant_1" })

    expect(result).toEqual({ success: true, queued: true, id: "out_1" })
    expect(outboxMock.enqueueWhatsappMessage).toHaveBeenCalledWith({
      target: "628123456789",
      message: "halo",
      tenantId: "tenant_1",
      provider: "baileys",
    })
    expect(fonnteMock.sendWA).not.toHaveBeenCalled()
  })
})
