import type { MetadataRoute } from "next"
import { getPublicAppUrl } from "@/lib/public-url"

export default function sitemap(): MetadataRoute.Sitemap {
  const publicAppUrl = getPublicAppUrl()
  return [
    {
      url: publicAppUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
