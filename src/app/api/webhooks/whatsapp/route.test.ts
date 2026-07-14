import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  tenant: {
    findFirst: vi.fn(),
  },
  whatsappConversationState: {
    findFirst: vi.fn(),
  },
}))

const assistantMock = vi.hoisted(() => ({
  handleInboundCustomerMessage: vi.fn(),
}))

const fonnteMock = vi.hoisted(() => ({
  sendWA: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitResponse: vi.fn(),
}))

vi.mock("@/lib/whatsapp-intents", () => ({
  consumeOwnerVerificationIntent: vi.fn(),
  extractWhatsappIntentToken: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/ai-assistant", () => assistantMock)

vi.mock("@/lib/fonnte", () => fonnteMock)

vi.mock("@/lib/audit", () => ({
  auditEvent: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  durationMs: vi.fn().mockReturnValue(1),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  maskPhone: (value: string) => value,
  requestIdFrom: vi.fn().mockReturnValue("req_test"),
  safeError: (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) }),
}))

import { POST } from "./route"

const tenant = {
  id: "tenant_1",
  name: "Barbershop Andi",
  slug: "barbershop-andi",
  description: "",
  operationalHours: "",
  services: [],
  setupCompleted: true,
}

describe("WhatsApp webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WA_WEBHOOK_SECRET = "webhook-secret"
    assistantMock.handleInboundCustomerMessage.mockResolvedValue({ reply: "ok" })
    fonnteMock.sendWA.mockResolvedValue({ success: true })
  })

  it("routes customer messages from stored conversation state without tenant query", async () => {
    prismaMock.whatsappConversationState.findFirst.mockResolvedValue({ tenant })

    const res = await POST(new Request("http://localhost/api/webhooks/whatsapp?secret=webhook-secret", {
      method: "POST",
      body: JSON.stringify({
        sender: "628123456789",
        message: "cek antrian saya",
      }),
    }))

    expect(res.status).toBe(200)
    expect(prismaMock.whatsappConversationState.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: "628123456789" },
    }))
    expect(assistantMock.handleInboundCustomerMessage).toHaveBeenCalledWith({
      tenant,
      from: "628123456789",
      message: "cek antrian saya",
    })
  })

  it("does not use tenant from query string as routing context", async () => {
    prismaMock.whatsappConversationState.findFirst.mockResolvedValue(null)

    const res = await POST(new Request("http://localhost/api/webhooks/whatsapp?tenant=barbershop-andi&secret=webhook-secret", {
      method: "POST",
      body: JSON.stringify({
        sender: "628123456789",
        message: "cek antrian saya",
      }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reply).toContain("Saya belum tahu")
    expect(fonnteMock.sendWA).toHaveBeenCalledWith("628123456789", expect.stringContaining("Saya belum tahu"))
    expect(prismaMock.tenant.findFirst).not.toHaveBeenCalled()
    expect(assistantMock.handleInboundCustomerMessage).not.toHaveBeenCalled()
  })
})
