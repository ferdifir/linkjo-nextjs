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
  if (process.env.E2E_SKIP_NOTIFICATIONS === "1") {
    return { success: true }
  }

  const token = getApiKey()
  if (!token) {
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
      return { success: true }
    }

    return { success: false, error: data.reason || "unknown error" }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "network error" }
  }
}
