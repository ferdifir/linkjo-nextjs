import { describe, expect, it } from "vitest"
import { formatOperationalHours, isWithinOperationalHours } from "./operational-hours"

const operationalHours = JSON.stringify({
  timeZone: "Asia/Jakarta",
  weekly: {
    mon: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "20:00", end: "02:00" }],
  },
})

describe("operational hours", () => {
  it("allows times inside configured weekly ranges", () => {
    expect(isWithinOperationalHours(new Date("2026-07-13T03:00:00.000Z"), operationalHours)).toBe(true)
  })

  it("rejects gaps between multiple ranges in the same day", () => {
    expect(isWithinOperationalHours(new Date("2026-07-13T05:30:00.000Z"), operationalHours)).toBe(false)
  })

  it("rejects days without configured ranges", () => {
    expect(isWithinOperationalHours(new Date("2026-07-18T03:00:00.000Z"), operationalHours)).toBe(false)
  })

  it("supports overnight ranges", () => {
    expect(isWithinOperationalHours(new Date("2026-07-14T16:30:00.000Z"), operationalHours)).toBe(true)
  })

  it("does not restrict booking when config is empty or invalid", () => {
    expect(isWithinOperationalHours(new Date("2026-07-15T03:00:00.000Z"), "")).toBe(true)
    expect(isWithinOperationalHours(new Date("2026-07-15T03:00:00.000Z"), "not-json")).toBe(true)
  })

  it("formats repeated day ranges compactly", () => {
    expect(formatOperationalHours(operationalHours)).toContain("Rabu-Jumat 09:00-17:00")
    expect(formatOperationalHours(operationalHours)).toContain("Senin 09:00-12:00, 13:00-17:00")
  })
})
