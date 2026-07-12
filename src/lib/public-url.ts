const DEFAULT_PUBLIC_APP_URL = "https://linkjo.co"

export function getPublicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    DEFAULT_PUBLIC_APP_URL
  ).replace(/\/+$/, "")
}

export function publicTenantUrl(slug: string) {
  return `${getPublicAppUrl()}/${slug.replace(/^\/+/, "")}`
}

export function publicAppHost() {
  try {
    return new URL(getPublicAppUrl()).host
  } catch {
    return getPublicAppUrl().replace(/^https?:\/\//, "")
  }
}
