import { ImageResponse } from "next/og"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "white",
          background:
            "radial-gradient(circle at 72% 48%, rgba(16,185,129,0.28), transparent 34%), linear-gradient(135deg, #061411 0%, #09090b 48%, #050505 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#34d399",
              color: "#03110d",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            l
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>linkjo</div>
            <div style={{ color: "#34d399", fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>QUEUE.AI</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 0.96, letterSpacing: -2 }}>
            Sistem antrean dan booking via WhatsApp
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 28, lineHeight: 1.35 }}>
            Pelanggan ambil nomor antrean, booking, dan menerima notifikasi tanpa install aplikasi.
          </div>
        </div>

        <div style={{ color: "#34d399", fontSize: 24, fontWeight: 800 }}>linkjo.co</div>
      </div>
    ),
    size,
  )
}
