import { describe, expect, it } from "vitest"
import { missingTemplateVariables, requiredTemplateVariables } from "./message-templates"
import { applyTemplate } from "./notifications"
import { findMatchingService, formatServices } from "./services"

describe("notification templates", () => {
  it("replaces known variables and leaves unknown variables intact", () => {
    expect(applyTemplate("Nomor #{no} {unknown}", { no: 12 })).toBe("Nomor #12 {unknown}")
  })

  it("detects required dynamic variables from default templates", () => {
    expect(requiredTemplateVariables("booking_created")).toEqual([
      "{booking_id}",
      "{service}",
      "{scheduled_at}",
      "{public_token}",
    ])
    expect(missingTemplateVariables("booking_created", "Booking {booking_id} untuk {service}")).toEqual([
      "{scheduled_at}",
      "{public_token}",
    ])
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
