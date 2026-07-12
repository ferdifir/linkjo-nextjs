"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { Map, MapControls, MapMarker, MarkerContent } from "@/components/ui/map"

export function PublicLocationMap({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const [locationLabel, setLocationLabel] = useState("")
  const [loadingLabel, setLoadingLabel] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setLoadingLabel(true)
      })
      .then(() => fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, { signal: controller.signal }))
      .then((res) => res.ok ? res.json() : { label: "" })
      .then((data: { label?: string }) => {
        setLocationLabel(data.label?.trim() || "")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLocationLabel("")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingLabel(false)
      })

    return () => controller.abort()
  }, [latitude, longitude])

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-sm text-zinc-300">
        {loadingLabel ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-emerald-400" />
        ) : (
          <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        )}
        <p className="leading-relaxed">{loadingLabel ? "Mencari nama lokasi..." : locationLabel || "Lokasi bisnis"}</p>
      </div>
      <div className="h-[220px] overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
        <Map center={[longitude, latitude]} zoom={15} theme="dark">
          <MapControls />
          <MapMarker longitude={longitude} latitude={latitude}>
            <MarkerContent>
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-zinc-950 shadow-lg">
                <MapPin className="size-4 fill-current" />
              </div>
            </MarkerContent>
          </MapMarker>
        </Map>
      </div>
    </div>
  )
}
