export function displayName(name: string | null | undefined, phone: string) {
  const trimmed = typeof name === "string" ? name.trim() : ""
  if (!trimmed) return ""
  return trimmed === phone ? "" : trimmed
}
