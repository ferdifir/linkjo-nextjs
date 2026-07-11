"use client"

import { MapPin } from "lucide-react"
import { Map, MapControls, MapMarker, MarkerContent } from "@/components/ui/map"

export function PublicLocationMap({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  return (
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
  )
}
