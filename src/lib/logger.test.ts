import { describe, expect, it } from "vitest"
import { maskPhone, requestIdFrom, safeError } from "./logger"

describe("logger helpers", () => {
  it("masks phone numbers before they reach logs", () => {
    expect(maskPhone("628123456789")).toBe("62812****6789")
    expect(maskPhone("+62 812-3456-789")).toBe("62812****6789")
    expect(maskPhone("123")).toBe("***")
    expect(maskPhone(null)).toBeNull()
  })

  it("uses upstream request ids when available", () => {
    const req = new Request("http://localhost", {
      headers: { "x-request-id": "req_123" },
    })

    expect(requestIdFrom(req)).toBe("req_123")
  })

  it("serializes errors safely", () => {
    expect(safeError(new Error("boom"))).toMatchObject({
      name: "Error",
      message: "boom",
    })
    expect(safeError("plain")).toEqual({ message: "plain" })
  })
})
