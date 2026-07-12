import type { Metadata } from "next"
import { getPublicAppUrl } from "@/lib/public-url"
import LandingPage from "./landing-client"

const title = "Linkjo - Sistem Antrean dan Booking via WhatsApp"
const description =
  "Buat halaman antrean bisnis, bagikan link atau QR, lalu pelanggan bisa ambil nomor antrean dan booking lewat WhatsApp tanpa install aplikasi."

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Linkjo",
  keywords: [
    "sistem antrean online",
    "aplikasi antrean WhatsApp",
    "booking WhatsApp",
    "manajemen antrean",
    "QR antrean",
    "AI WhatsApp bisnis",
    "Linkjo",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Linkjo",
    title,
    description,
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function Page() {
  const publicAppUrl = getPublicAppUrl()
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Linkjo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: publicAppUrl,
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "IDR",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  )
}
