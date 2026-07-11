"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { OperationalHoursEditor } from "@/components/operational-hours-editor"
import { ServicesEditor, type ServiceEditorItem } from "@/components/services-editor"
import { LocationPicker, type LocationValue } from "@/components/location-picker"

export default function SetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [businessName, setBusinessName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null })
  const [operationalHours, setOperationalHours] = useState("")
  const [services, setServices] = useState<ServiceEditorItem[]>([
    { name: "", description: "", duration_minutes: 30, price: null, active: true },
  ])
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) {
      toast.error("Nama bisnis harus diisi")
      return
    }
    if (!services.some((service) => service.name.trim())) {
      toast.error("Minimal satu layanan harus diisi")
      return
    }
    setLoading(true)
    try {
      await api("/tenant/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: businessName.trim(),
          description: description.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          operational_hours: operationalHours,
          services,
        }),
      })
      toast.success("Profil bisnis disimpan")
      router.replace("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-dvh items-center justify-center overflow-hidden bg-[#09090b] p-4 font-sans text-zinc-100 sm:p-6">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[5%] top-[-10%] size-[45vw] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[5%] size-[40vw] rounded-full bg-zinc-800/10 blur-[120px]" />
        <div className="absolute right-[25%] top-[30%] size-[25vw] rounded-full bg-emerald-400/5 blur-[100px]" />
      </div>

      <div className="animate-fade-in-up relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/70 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <div className="border-b border-white/5 px-5 py-5 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Lengkapi Bisnis</h1>
          {user && (
            <p className="mt-1 font-mono text-xs text-emerald-400">
              {user.username ? `linkjo.co/${user.username}` : user.phone}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="business" className="text-xs font-medium text-zinc-400">Nama Bisnis</Label>
              <Input
                id="business"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="h-10 border-white/10 bg-zinc-950/60 px-3 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description" className="text-xs font-medium text-zinc-400">Deskripsi Singkat</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Barbershop premium di Jakarta Selatan"
                className="h-10 border-white/10 bg-zinc-950/60 px-3 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
              />
            </div>
            <div className="sm:col-span-2">
              <ServicesEditor value={services} onChange={setServices} />
            </div>
            <div className="sm:col-span-2">
              <LocationPicker value={location} onChange={setLocation} />
            </div>
            <div className="sm:col-span-2">
              <OperationalHoursEditor value={operationalHours} onChange={setOperationalHours} />
            </div>
          </div>
          <div className="border-t border-white/5 px-5 py-4 sm:px-6">
            <Button className="h-10 w-full bg-emerald-400 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-[0.98]" type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan dan Buka Dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
