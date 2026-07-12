import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/contexts/auth-context"
import { getPublicAppUrl } from "@/lib/public-url"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: "Linkjo",
  description: "Manajemen Antrian Pintar",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
