import type { MetadataRoute } from "next"
import { getPublicAppUrl } from "@/lib/public-url"

export default function robots(): MetadataRoute.Robots {
  const publicAppUrl = getPublicAppUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/settings", "/onboarding"],
    },
    sitemap: `${publicAppUrl}/sitemap.xml`,
  }
}
