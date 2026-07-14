import { randomUUID } from "crypto"
import pino from "pino"

const REDACT_PATHS = [
  "authorization",
  "headers.authorization",
  "secret",
  "token",
  "jwt",
  "otp",
  "code",
  "password",
  "public_token",
  "publicToken",
  "body.secret",
  "body.token",
  "body.otp",
  "body.code",
  "body.public_token",
  "body.publicToken",
]

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    service: "linkjo-next",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
  formatters: {
    level(label) {
      return { level: label }
    },
  },
})

export type LogMeta = Record<string, unknown>

export function requestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ||
    req.headers.get("cf-ray") ||
    req.headers.get("x-vercel-id") ||
    randomUUID()
}

export function maskPhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const digits = value.replace(/\D/g, "")
  if (digits.length < 7) return "***"
  return `${digits.slice(0, 5)}****${digits.slice(-4)}`
}

export function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { message: String(error) }
}

export function durationMs(startedAt: number): number {
  return Date.now() - startedAt
}
