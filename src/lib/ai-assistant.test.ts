import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  history: {
    create: vi.fn(),
  },
}))

const fonnteMock = vi.hoisted(() => ({
  sendWA: vi.fn(),
}))

const agentMock = vi.hoisted(() => ({
  answerWithWhatsappAgent: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/fonnte", () => fonnteMock)

vi.mock("@/lib/whatsapp-agent", () => agentMock)

vi.mock("@/lib/audit", () => ({
  auditEvent: vi.fn(),
}))

import { handleInboundCustomerMessage } from "./ai-assistant"

describe("handleInboundCustomerMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.history.create.mockResolvedValue({})
    fonnteMock.sendWA.mockResolvedValue({ success: true })
  })

  it("asks for clarification instead of booking the first ambiguous service match", async () => {
    const result = await handleInboundCustomerMessage({
      from: "628123456789",
      message: "booking hair 2026-07-20 14:30",
      tenant: {
        id: "tenant_1",
        name: "E2E Salon",
        slug: "e2e-salon",
        description: "",
        operationalHours: "",
        services: [
          { id: "svc_1", name: "Hair Coloring", durationMinutes: 60, price: 150000, active: true },
          { id: "svc_2", name: "Hair Treatment", durationMinutes: 45, price: 120000, active: true },
        ],
      },
    })

    expect(result.reply).toContain("beberapa layanan")
    expect(result.reply).toContain("Hair Coloring")
    expect(result.reply).toContain("Hair Treatment")
    expect(agentMock.answerWithWhatsappAgent).not.toHaveBeenCalled()
    expect(fonnteMock.sendWA).toHaveBeenCalledWith("628123456789", result.reply, { tenantId: "tenant_1" })
  })
})
