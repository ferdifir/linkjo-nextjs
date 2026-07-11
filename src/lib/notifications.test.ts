import { describe, expect, it } from "vitest"
import { applyTemplate } from "./notifications"
import { findMatchingService, formatServices } from "./services"

describe("notification templates", () => {
  it("replaces known variables and leaves unknown variables intact", () => {
    expect(applyTemplate("Nomor #{no} {unknown}", { no: 12 })).toBe("Nomor #12 {unknown}")
  })
})

describe("service helpers", () => {
  it("formats services with duration and price", () => {
    expect(formatServices([{ name: "Haircut", durationMinutes: 45, price: 75000, active: true }]))
      .toContain("Haircut (45 menit, Rp")
  })

  it("matches customer text to active service names", () => {
    const services = [{ id: "svc_1", name: "Hair Coloring" }]
    expect(findMatchingService(services, "booking coloring")?.id).toBe("svc_1")
  })
})
