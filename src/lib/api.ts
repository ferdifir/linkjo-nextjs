export async function api<T = unknown>(
  path: string,
  options: RequestInit & { redirectOnUnauthorized?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  const { redirectOnUnauthorized = true, ...requestOptions } = options
  const res = await fetch(`/api${path}`, { ...requestOptions, headers })

  if (res.status === 401 && redirectOnUnauthorized && typeof window !== "undefined") {
    window.location.href = "/auth"
    throw new Error("Unauthorized")
  }

  const text = await res.text()
  if (!text) {
    if (!res.ok) throw new Error(res.statusText || "Request failed")
    return undefined as T
  }

  let data: (T & { error?: string }) | null = null
  try {
    data = JSON.parse(text) as T & { error?: string }
  } catch {
    if (!res.ok) throw new Error(text || res.statusText || "Request failed")
    return text as unknown as T
  }

  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed")
  return data
}
