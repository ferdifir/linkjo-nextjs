import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  antrian: {
    count: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

import { businessDateString, createQueueEntry, queueDateFor } from "./queue"

describe("queue business date", () => {
  it("uses Asia/Jakarta calendar day for daily queue reset", () => {
    const date = new Date("2026-07-11T17:30:00.000Z")

    expect(businessDateString(date)).toBe("2026-07-12")
    expect(queueDateFor(date).toISOString()).toBe("2026-07-12T00:00:00.000Z")
  })

  it("keeps the previous Jakarta date before local midnight", () => {
    const date = new Date("2026-07-11T16:59:59.000Z")

    expect(businessDateString(date)).toBe("2026-07-11")
  })
})

describe("queue entries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$queryRaw.mockResolvedValue([{ avg_wait_min: 8 }])
    prismaMock.antrian.count.mockResolvedValue(2)
  })

  it("generates a walk-in customer name and stores no phone", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      antrian: {
        findFirst: vi.fn().mockResolvedValue({ noAntrian: 11 }),
        create: vi.fn().mockResolvedValue({
          noAntrian: 12,
          nama: "Pelanggan #12",
          phone: null,
          status: "menunggu",
        }),
      },
    }
    prismaMock.$transaction.mockImplementation((callback) => callback(tx))

    const entry = await createQueueEntry("tenant_1", { walk_in: true }, { allowWalkIn: true })

    expect(tx.antrian.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nama: "Pelanggan #12",
        phone: null,
        noAntrian: 12,
      }),
    }))
    expect(entry).toMatchObject({
      no: 12,
      nama: "Pelanggan #12",
      phone: null,
      status: "menunggu",
      estimated_wait_min: 16,
    })
  })

  it("does not allow public callers to create a walk-in without a customer name", async () => {
    await expect(createQueueEntry("tenant_1", { walk_in: true })).rejects.toThrow("nama pelanggan harus diisi")
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
