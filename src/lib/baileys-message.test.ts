import { describe, expect, it } from "vitest"
import type { WAMessage } from "baileys"
import { jidForPhone, parseBaileysMessage } from "./baileys-message"

describe("Baileys message parser", () => {
  it("extracts text from personal chat messages", () => {
    const parsed = parseBaileysMessage({
      key: { remoteJid: "628123456789@s.whatsapp.net", fromMe: false },
      message: { conversation: "halo" },
    } as WAMessage)

    expect(parsed).toEqual({
      from: "628123456789",
      text: "halo",
      remoteJid: "628123456789@s.whatsapp.net",
    })
  })

  it("extracts extended text messages", () => {
    const parsed = parseBaileysMessage({
      key: { remoteJid: "628123456789@s.whatsapp.net", fromMe: false },
      message: { extendedTextMessage: { text: "cek antrian" } },
    } as WAMessage)

    expect(parsed?.text).toBe("cek antrian")
  })

  it("extracts text from wrapped ephemeral messages", () => {
    const parsed = parseBaileysMessage({
      key: { remoteJid: "628123456789@s.whatsapp.net", fromMe: false },
      message: {
        ephemeralMessage: {
          message: {
            extendedTextMessage: { text: "halo" },
          },
        },
      },
    } as WAMessage)

    expect(parsed?.text).toBe("halo")
  })

  it("ignores group, status, broadcast, newsletter, and self messages", () => {
    const ignored = [
      { key: { remoteJid: "1203630@g.us", fromMe: false }, message: { conversation: "halo" } },
      { key: { remoteJid: "status@broadcast", fromMe: false }, message: { conversation: "halo" } },
      { key: { remoteJid: "628123456789@broadcast", fromMe: false }, message: { conversation: "halo" } },
      { key: { remoteJid: "123@newsletter", fromMe: false }, message: { conversation: "halo" } },
      { key: { remoteJid: "628123456789@s.whatsapp.net", fromMe: true }, message: { conversation: "halo" } },
    ] as WAMessage[]

    expect(ignored.map(parseBaileysMessage)).toEqual([null, null, null, null, null])
  })

  it("builds a personal chat jid from a phone number", () => {
    expect(jidForPhone("+62 812-3456-789")).toBe("628123456789@s.whatsapp.net")
  })
})
