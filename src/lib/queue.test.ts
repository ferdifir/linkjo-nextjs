import { describe, expect, it } from "vitest"
import { businessDateString, queueDateFor } from "./queue"

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
