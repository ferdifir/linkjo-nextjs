"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { ArrowLeft, ExternalLink, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { OperationalHoursEditor } from "@/components/operational-hours-editor"
import { ServicesEditor, type ServiceEditorItem } from "@/components/services-editor"
import { LocationPicker, type LocationValue } from "@/components/location-picker"
import { MessageTemplatesEditor } from "@/components/message-templates-editor"
import { missingTemplateVariables, type MessageTemplate } from "@/lib/message-templates"
import { publicTenantUrl } from "@/lib/public-url"

type TenantProfile = {
  name: string
  owner_name: string
  slug: string | null
  description: string
  latitude: number | null
  longitude: number | null
  operational_hours: string
  services: ServiceEditorItem[]
  setup_completed: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const publicProfileUrl = user?.username ? publicTenantUrl(user.username) : ""
  const [ownerName, setOwnerName] = useState("")
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [businessName, setBusinessName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null })
  const [operationalHours, setOperationalHours] = useState("")
  const [services, setServices] = useState<ServiceEditorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const [profile, templateData] = await Promise.all([
          api<TenantProfile>("/tenant/profile"),
          api<MessageTemplate[]>("/templates"),
        ])

        setBusinessName(profile.name)
        setOwnerName(profile.owner_name)
        setDescription(profile.description)
        setLocation({ latitude: profile.latitude, longitude: profile.longitude })
        setOperationalHours(profile.operational_hours)
        setServices(profile.services.length > 0 ? profile.services : [{ name: "", description: "", duration_minutes: 30, price: null, active: true }])
        setTemplates(templateData)
      } catch {
        toast.error("Gagal memuat pengaturan")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  async function saveProfile() {
    if (!businessName.trim()) {
      toast.error("Nama bisnis harus diisi")
      return
    }
    if (!ownerName.trim()) {
      toast.error("Nama akun harus diisi")
      return
    }
    if (!services.some((service) => service.name.trim())) {
      toast.error("Minimal satu layanan harus diisi")
      return
    }

    setSavingProfile(true)
    try {
      await api("/tenant/profile", {
        method: "PUT",
        body: JSON.stringify({
          owner_name: ownerName.trim(),
          name: businessName.trim(),
          description: description.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          operational_hours: operationalHours,
          services,
        }),
      })
      toast.success("Profil bisnis disimpan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil")
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveTemplate(key: string) {
    const template = templates.find((item) => item.key === key)
    if (!template) return
    if (missingTemplateVariables(template.key, template.value).length > 0) {
      toast.error("Token dinamis pada template pesan jangan diubah atau dihapus")
      return
    }

    setSaving(key)
    try {
      await api(`/templates/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value: template.value }),
      })
      toast.success(`Template ${key} disimpan`)
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setSaving(null)
    }
  }

  async function resetTemplate(key: string) {
    setSaving(key)
    try {
      await api(`/templates/${key}/reset`, { method: "POST" })
      const data = await api<MessageTemplate[]>("/templates")
      setTemplates(data)
      toast.success(`Template ${key} direset`)
    } catch {
      toast.error("Gagal mereset")
    } finally {
      setSaving(null)
    }
  }

  async function handleLogout() {
    logout()
    router.replace("/")
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#09090b] font-sans text-zinc-100">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[5%] top-[-10%] size-[45vw] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[5%] size-[40vw] rounded-full bg-zinc-800/10 blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center gap-2 border-b border-white/5 bg-[#09090b]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Pengaturan</h1>
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400">Account & Templates</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-4xl space-y-4">
        {user && (
          <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm text-white">Akun</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-zinc-400">
              <p>Nama: {ownerName || user.name || "Belum diisi"}</p>
              <p>Nomor WhatsApp: {user.phone}</p>
              {publicProfileUrl && (
                <a
                  href={publicProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-emerald-400 hover:text-emerald-300"
                >
                  {publicProfileUrl}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm text-white">Profil Bisnis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-emerald-400" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama Akun">
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
                    />
                  </Field>
                  <Field label="Nama Bisnis">
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
                    />
                  </Field>
                  <Field label="Deskripsi">
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
                    />
                  </Field>
                </div>

                <ServicesEditor value={services} onChange={setServices} />

                <LocationPicker value={location} onChange={setLocation} />

                <OperationalHoursEditor value={operationalHours} onChange={setOperationalHours} />

                <Button
                  className="w-full bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? <Loader2 className="size-4 animate-spin" /> : "Simpan Profil"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm text-white">Template Pesan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-emerald-400" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-zinc-500">Tidak ada template</p>
            ) : (
              <MessageTemplatesEditor
                value={templates}
                onChange={setTemplates}
                renderActions={(template) => (
                  <>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      onClick={() => resetTemplate(template.key)}
                      disabled={saving === template.key}
                    >
                      {saving === template.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90"
                      onClick={() => saveTemplate(template.key)}
                      disabled={saving === template.key}
                    >
                      {saving === template.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Simpan"
                      )}
                    </Button>
                  </>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full bg-red-500/10 text-red-300 hover:bg-red-500/20" onClick={handleLogout}>
          Logout
        </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-zinc-400">{label}</Label>
      {children}
    </div>
  )
}
