import { durationMs, logger, maskPhone, safeError } from "@/lib/logger"

const FONNTE_API = "https://api.fonnte.com/send"

function getApiKey(): string | null {
  return process.env.FONNTE_API_KEY || null
}

export function isFonnteReady(): boolean {
  return !!getApiKey()
}

export async function sendWA(
  target: string,
  message: string,
  options?: { typing?: boolean; countryCode?: string },
): Promise<{ success: boolean; error?: string }> {
  const startedAt = Date.now()
  const logContext = {
    event: "whatsapp.send",
    provider: "fonnte",
    target: maskPhone(target),
    message_length: message.length,
  }

  if (process.env.E2E_SKIP_NOTIFICATIONS === "1") {
    logger.debug({ ...logContext, status: "skipped", reason: "e2e_skip_notifications" })
    return { success: true }
  }

  const token = getApiKey()
  if (!token) {
    logger.warn({ ...logContext, status: "failed", reason: "missing_api_key", duration_ms: durationMs(startedAt) })
    return { success: false, error: "FONNTE_API_KEY not configured" }
  }

  try {
    const res = await fetch(FONNTE_API, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target,
        message,
        typing: options?.typing ?? true,
        countryCode: options?.countryCode ?? "62",
      }),
    })

    const data = await res.json()

    if (data.status === true) {
      logger.info({
        ...logContext,
        status: "success",
        http_status: res.status,
        duration_ms: durationMs(startedAt),
      })
      return { success: true }
    }

    const error = data.reason || "unknown error"
    logger.warn({
      ...logContext,
      status: "failed",
      http_status: res.status,
      provider_reason: error,
      duration_ms: durationMs(startedAt),
    })
    return { success: false, error }
  } catch (err) {
    logger.error({
      ...logContext,
      status: "error",
      err: safeError(err),
      duration_ms: durationMs(startedAt),
    })
    return { success: false, error: err instanceof Error ? err.message : "network error" }
  }
}
