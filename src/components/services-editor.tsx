"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ServiceEditorItem = {
  id?: string
  name: string
  description: string
  duration_minutes: number
  price: number | null
  active: boolean
}

const EMPTY_SERVICE: ServiceEditorItem = {
  name: "",
  description: "",
  duration_minutes: 30,
  price: null,
  active: true,
}

export function ServicesEditor({
  value,
  onChange,
}: {
  value: ServiceEditorItem[]
  onChange: (value: ServiceEditorItem[]) => void
}) {
  const services = value.length > 0 ? value : [EMPTY_SERVICE]

  function update(index: number, patch: Partial<ServiceEditorItem>) {
    onChange(services.map((service, serviceIndex) => (
      serviceIndex === index ? { ...service, ...patch } : service
    )))
  }

  function remove(index: number) {
    const next = services.filter((_, serviceIndex) => serviceIndex !== index)
    onChange(next.length > 0 ? next : [{ ...EMPTY_SERVICE }])
  }

  function add() {
    onChange([...services, { ...EMPTY_SERVICE }])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs font-medium text-zinc-400">Layanan</Label>
          <p className="text-[10px] text-zinc-600">Dipakai customer saat booking.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="border-white/10 bg-zinc-900 text-zinc-300" onClick={add}>
          <Plus className="size-4" />
          Tambah
        </Button>
      </div>

      <div className="space-y-2">
        {services.map((service, index) => (
          <div key={index} className="rounded-lg border border-white/5 bg-zinc-950/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_112px_120px_auto]">
              <Input
                value={service.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Nama layanan"
                className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600"
              />
              <Input
                type="number"
                min={1}
                max={1440}
                value={service.duration_minutes}
                onChange={(event) => update(index, { duration_minutes: Number(event.target.value) || 30 })}
                className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white"
              />
              <Input
                type="number"
                min={0}
                value={service.price ?? ""}
                onChange={(event) => update(index, { price: event.target.value ? Number(event.target.value) : null })}
                placeholder="Harga"
                className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-400 hover:bg-red-500/10"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={service.description}
                onChange={(event) => update(index, { description: event.target.value })}
                placeholder="Deskripsi singkat"
                className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600"
              />
              <label className="flex items-center gap-2 px-1 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={service.active}
                  onChange={(event) => update(index, { active: event.target.checked })}
                  className="size-4 rounded border-white/10 bg-zinc-950 accent-emerald-400"
                />
                Aktif
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
