import QRCode from "qrcode"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const data = searchParams.get("data") || ""

  if (!data || data.length > 500) {
    return Response.json({ error: "data QR tidak valid" }, { status: 400 })
  }

  const svg = await QRCode.toString(data, {
    type: "svg",
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  })

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
