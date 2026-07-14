import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  booking: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
}))

const notificationMock = vi.hoisted(() => ({
  notifyBookingCancelled: vi.fn(),
  notifyBookingConfirmed: vi.fn(),
  notifyBookingRescheduled: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  withRequiredClaims: (handler: (claims: { tenant_id: string }) => Promise<Response> | Response) =>
    handler({ tenant_id: "tenant_1" }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/notifications", () => notificationMock)

vi.mock("@/lib/audit", () => ({
  auditEvent: vi.fn(),
}))

describe("owner booking actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.tenant.findUnique.mockResolvedValue({ operationalHours: "" })
  })

  it("notifies the customer when an owner confirms a booking", async () => {
    const { PUT } = await import("./confirm/route")
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 12n,
      phone: "628123456789",
      service: "Haircut",
      scheduledAt: new Date("2026-07-20T07:00:00.000Z"),
    })

    const res = await PUT(new Request("http://localhost/api/bookings/12/confirm"), {
      params: Promise.resolve({ id: "12" }),
    })

    expect(res.status).toBe(200)
    expect(notificationMock.notifyBookingConfirmed).toHaveBeenCalledWith("tenant_1", "628123456789", {
      id: "12",
      service: "Haircut",
      scheduled_at: new Date("2026-07-20T07:00:00.000Z"),
    })
  })

  it("notifies the customer when an owner reschedules a booking", async () => {
    const { PUT } = await import("./reschedule/route")
    prismaMock.booking.findFirst.mockResolvedValue({ status: "confirmed" })
    prismaMock.booking.update.mockResolvedValue({
      id: 12n,
      phone: "628123456789",
      service: "Haircut",
      scheduledAt: new Date("2026-07-21T08:00:00.000Z"),
    })

    const res = await PUT(
      new Request("http://localhost/api/bookings/12/reschedule", {
        method: "PUT",
        body: JSON.stringify({ scheduled_at: "2026-07-21T08:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "12" }) },
    )

    expect(res.status).toBe(200)
    expect(notificationMock.notifyBookingRescheduled).toHaveBeenCalledWith("tenant_1", "628123456789", {
      id: "12",
      service: "Haircut",
      scheduled_at: new Date("2026-07-21T08:00:00.000Z"),
    })
  })

  it("notifies the customer when an owner cancels a booking", async () => {
    const { PUT } = await import("./cancel/route")
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 12n,
      phone: "628123456789",
    })

    const res = await PUT(new Request("http://localhost/api/bookings/12/cancel"), {
      params: Promise.resolve({ id: "12" }),
    })

    expect(res.status).toBe(200)
    expect(notificationMock.notifyBookingCancelled).toHaveBeenCalledWith("tenant_1", "628123456789", "12")
  })
})
