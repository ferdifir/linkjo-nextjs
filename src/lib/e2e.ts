export function isE2eRequestAllowed(req: Request): boolean {
  if (process.env.E2E_TEST_MODE !== "1") return false

  const hostHeader = req.headers.get("host")?.toLowerCase() || ""
  if (hostHeader.startsWith("[::1]")) return true

  const host = hostHeader.split(":")[0]
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

export function e2eNotFound() {
  return Response.json({ error: "not found" }, { status: 404 })
}
