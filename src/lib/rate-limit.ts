import { prisma } from "@/lib/prisma"

type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  const rows = await prisma.$queryRaw<{ count: number; reset_at: Date }[]>`
    INSERT INTO rate_limits (key, count, reset_at, updated_at)
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.reset_at <= ${now} THEN 1
        ELSE rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN rate_limits.reset_at <= ${now} THEN ${resetAt}
        ELSE rate_limits.reset_at
      END,
      updated_at = ${now}
    RETURNING count, reset_at
  `

  const updated = rows[0]
  const allowed = updated.count <= limit
  return {
    allowed,
    remaining: allowed ? Math.max(0, limit - updated.count) : 0,
    resetAt: updated.reset_at,
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

export function rateLimitResponse(resetAt: Date) {
  return Response.json(
    { error: "terlalu banyak permintaan, coba lagi nanti" },
    {
      status: 429,
      headers: { "Retry-After": Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)).toString() },
    },
  )
}
