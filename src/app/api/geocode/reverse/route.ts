import { getPublicAppUrl } from "@/lib/public-url"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const latitude = Number(url.searchParams.get("lat"))
  const longitude = Number(url.searchParams.get("lng"))

  if (!isValidCoordinate(latitude, longitude)) {
    return Response.json({ error: "koordinat tidak valid" }, { status: 400 })
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude.toString(),
    lon: longitude.toString(),
    zoom: "18",
    addressdetails: "1",
  })

  let res: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `Linkjo (${getPublicAppUrl()})`,
      },
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
    })
  } catch {
    return Response.json({ label: "" }, { status: 200 })
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    return Response.json({ label: "" }, { status: 200 })
  }

  const data = await res.json() as { display_name?: unknown; name?: unknown }
  const label = typeof data.display_name === "string"
    ? data.display_name
    : typeof data.name === "string"
      ? data.name
      : ""

  return Response.json({ label })
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
}
