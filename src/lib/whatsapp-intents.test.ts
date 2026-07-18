import { describe, expect, it } from "vitest"

import { extractWhatsappIntentToken, whatsappIntentMessage } from "./whatsapp-intents"

describe("whatsapp intents", () => {
  it("builds a natural owner verification message", () => {
    expect(whatsappIntentMessage("ABC234")).toBe(
      "Halo Linkjo, saya ingin verifikasi nomor WhatsApp saya. Kode verifikasi: ABC234",
    )
  })

  it("extracts owner verification tokens from natural messages", () => {
    expect(extractWhatsappIntentToken("Halo Linkjo, saya ingin verifikasi nomor WhatsApp saya. Kode verifikasi: ABC234")).toBe("ABC234")
    expect(extractWhatsappIntentToken("kode verifikasi saya abc234")).toBe("ABC234")
    expect(extractWhatsappIntentToken("verifikasi linkjo dengan kode ABC234")).toBe("ABC234")
  })

  it("keeps accepting the legacy Linkjo command", () => {
    expect(extractWhatsappIntentToken("LINKJO ABC234")).toBe("ABC234")
    expect(extractWhatsappIntentToken("linkjo abc234")).toBe("ABC234")
  })

  it("accepts a standalone token only when the whole message is the token", () => {
    expect(extractWhatsappIntentToken("ABC234")).toBe("ABC234")
    expect(extractWhatsappIntentToken("kode saya ABC234")).toBeNull()
    expect(extractWhatsappIntentToken("ini kode saya ABC234")).toBeNull()
  })

  it("does not extract normal words from OTP notification text", () => {
    expect(extractWhatsappIntentToken("Kode OTP Linkjo kamu: 123456. Berlaku 5 menit.")).toBeNull()
  })
})
