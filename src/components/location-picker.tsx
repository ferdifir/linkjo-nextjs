"use client"

import { useEffect, useMemo, useState } from "react"
import { LocateFixed, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map"

const JAKARTA_CENTER: [number, number] = [106.8272, -6.1754]

export type LocationValue = {
  latitude: number | null
  longitude: number | null
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue
  onChange: (value: LocationValue) => void
}) {
  const [center, setCenter] = useState<[number, number]>(JAKARTA_CENTER)
  const [locating, setLocating] = useState(false)
  const [locationLabel, setLocationLabel] = useState("")
  const [resolvingLabel, setResolvingLabel] = useState(false)
  const marker = useMemo<[number, number] | null>(() => {
    if (value.latitude === null || value.longitude === null) return null
    return [value.longitude, value.latitude]
  }, [value.latitude, value.longitude])
  const mapCenter = marker ?? center

  useEffect(() => {
    if (!marker) locateCurrentPosition(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!marker) return

    const controller = new AbortController()

    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setResolvingLabel(true)
      })
      .then(() => fetch(`/api/geocode/reverse?lat=${marker[1]}&lng=${marker[0]}`, { signal: controller.signal }))
      .then((res) => res.ok ? res.json() : { label: "" })
      .then((data: { label?: string }) => {
        setLocationLabel(data.label?.trim() || "")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLocationLabel("")
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvingLabel(false)
      })

    return () => controller.abort()
  }, [marker])

  function setLocation(longitude: number, latitude: number) {
    onChange({
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    })
    setCenter([longitude, latitude])
  }

  function locateCurrentPosition(writeValue = true) {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [position.coords.longitude, position.coords.latitude]
        setCenter(next)
        if (writeValue) setLocation(next[0], next[1])
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs font-medium text-zinc-400">Lokasi Bisnis</Label>
          <p className="text-[10px] text-zinc-600">Klik peta atau geser marker untuk menentukan titik lokasi.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-white/10 bg-zinc-900 text-zinc-300" onClick={() => locateCurrentPosition(true)} disabled={locating}>
          <LocateFixed className="size-4" />
          {locating ? "Mencari" : "Lokasi Saya"}
        </Button>
      </div>

      <div className="h-[280px] overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
        <Map
          key={`${mapCenter[0]},${mapCenter[1]}`}
          center={mapCenter}
          zoom={marker ? 15 : 11}
          theme="dark"
        >
          <MapClickHandler onSelect={setLocation} />
          <MapControls />
          {marker && (
            <MapMarker
              longitude={marker[0]}
              latitude={marker[1]}
              draggable
              onDragEnd={(lngLat) => setLocation(lngLat.lng, lngLat.lat)}
            >
              <MarkerContent>
                <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-zinc-950 shadow-lg">
                  <MapPin className="size-4 fill-current" />
                </div>
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
      </div>

      <div className="rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Titik Terpilih</p>
        <div className="mt-1 flex items-start gap-2 text-sm text-zinc-300">
          {resolvingLabel ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-emerald-400" />
          ) : (
            <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          )}
          <p className="min-w-0 leading-relaxed">
            {!marker
              ? "Belum ada lokasi dipilih"
              : resolvingLabel
                ? "Mencari nama lokasi..."
                : locationLabel || "Lokasi dipilih"}
          </p>
        </div>
      </div>
    </div>
  )
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function MapClickHandler({ onSelect }: { onSelect: (longitude: number, latitude: number) => void }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return
    const handleClick = (event: { lngLat: { lng: number; lat: number } }) => {
      onSelect(event.lngLat.lng, event.lngLat.lat)
    }
    map.on("click", handleClick)
    return () => {
      map.off("click", handleClick)
    }
  }, [map, onSelect])

  return null
}
