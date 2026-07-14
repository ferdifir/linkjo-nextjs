import { afterEach, describe, expect, it } from "vitest"
import { isE2eRequestAllowed } from "./e2e"

const originalE2eMode = process.env.E2E_TEST_MODE

afterEach(() => {
  process.env.E2E_TEST_MODE = originalE2eMode
})

describe("isE2eRequestAllowed", () => {
  it("allows local requests only when e2e mode is enabled", () => {
    process.env.E2E_TEST_MODE = "1"

    const req = new Request("http://127.0.0.1:3100/api/e2e/otp", {
      headers: { host: "127.0.0.1:3100" },
    })

    expect(isE2eRequestAllowed(req)).toBe(true)
  })

  it("rejects public host requests even when e2e mode is enabled", () => {
    process.env.E2E_TEST_MODE = "1"

    const req = new Request("https://linkjo.my.id/api/e2e/otp", {
      headers: { host: "linkjo.my.id" },
    })

    expect(isE2eRequestAllowed(req)).toBe(false)
  })

  it("rejects local requests when e2e mode is disabled", () => {
    delete process.env.E2E_TEST_MODE

    const req = new Request("http://localhost:3100/api/e2e/otp", {
      headers: { host: "localhost:3100" },
    })

    expect(isE2eRequestAllowed(req)).toBe(false)
  })
})
