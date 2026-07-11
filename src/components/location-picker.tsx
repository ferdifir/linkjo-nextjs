"use client"

import { useEffect, useMemo, useState } from "react"
import { LocateFixed, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const marker = useMemo<[number, number] | null>(() => {
    if (value.latitude === null || value.longitude === null) return null
    return [value.longitude, value.latitude]
  }, [value.latitude, value.longitude])
  const mapCenter = marker ?? center

  useEffect(() => {
    if (!marker) locateCurrentPosition(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <p className="text-[10px] text-zinc-600">Klik peta atau geser marker untuk menentukan titik.</p>
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

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="number"
          step="0.000001"
          value={value.latitude ?? ""}
          onChange={(event) => onChange({ ...value, latitude: event.target.value ? Number(event.target.value) : null })}
          placeholder="Latitude"
          className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600"
        />
        <Input
          type="number"
          step="0.000001"
          value={value.longitude ?? ""}
          onChange={(event) => onChange({ ...value, longitude: event.target.value ? Number(event.target.value) : null })}
          placeholder="Longitude"
          className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600"
        />
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
