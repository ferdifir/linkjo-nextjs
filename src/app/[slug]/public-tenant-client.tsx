"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock, Clock3, Loader2, MapPin, MessageCircle, QrCode, Ticket } from "lucide-react"
import { toast } from "sonner"
import { PublicLocationMap } from "@/components/public-location-map"
import { publicAppHost } from "@/lib/public-url"

type TenantPublicProfile = {
  name: string
  slug: string
  description: string
  latitude: number | null
  longitude: number | null
  operational_hours: string
  services: Array<{
    id: string
    name: string
    description: string
    duration_minutes: number
    price: number | null
  }>
  services_text: string
  active_queue_count: number
  estimated_wait_min: number
  public_url: string
}

type QueueResult = {
  no: number
  estimated_wait_min: number
}

type BookingResult = {
  id: string
  public_token: string
  service: string
  scheduled_at: string
}

export default function PublicTenantClient({ tenant }: { tenant: TenantPublicProfile }) {
  const publicHost = publicAppHost()
  const [queueName, setQueueName] = useState("")
  const [queuePhone, setQueuePhone] = useState("")
  const [bookingName, setBookingName] = useState("")
  const [bookingPhone, setBookingPhone] = useState("")
  const [bookingServiceId, setBookingServiceId] = useState("")
  const [bookingSchedule, setBookingSchedule] = useState("")
  const [bookingNotes, setBookingNotes] = useState("")
  const [manageBookingId, setManageBookingId] = useState("")
  const [manageBookingPhone, setManageBookingPhone] = useState("")
  const [manageBookingToken, setManageBookingToken] = useState("")
  const [rescheduleAt, setRescheduleAt] = useState("")
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [loadingBooking, setLoadingBooking] = useState(false)
  const [loadingManage, setLoadingManage] = useState(false)
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null)
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const publicUrl = tenant.public_url
  const qrUrl = `/api/qr?data=${encodeURIComponent(publicUrl)}`

  async function joinQueue(e: React.FormEvent) {
    e.preventDefault()
    setLoadingQueue(true)
    setQueueResult(null)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: queueName, phone: queuePhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengambil antrian")
      setQueueResult(data)
      toast.success(`Nomor antrian #${data.no}`)
      setQueueName("")
      setQueuePhone("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengambil antrian")
    } finally {
      setLoadingQueue(false)
    }
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault()
    setLoadingBooking(true)
    setBookingResult(null)
    try {
      const scheduledAt = toJakartaIsoString(bookingSchedule)
      const res = await fetch(`/api/public/${tenant.slug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: bookingName,
          phone: bookingPhone,
          service_id: bookingServiceId,
          scheduled_at: scheduledAt,
          notes: bookingNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membuat booking")
      setBookingResult(data)
      toast.success(`Booking #${data.id} dibuat`)
      setBookingName("")
      setBookingPhone("")
      setBookingServiceId("")
      setBookingSchedule("")
      setBookingNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat booking")
    } finally {
      setLoadingBooking(false)
    }
  }

  async function rescheduleBooking(e: React.FormEvent) {
    e.preventDefault()
    setLoadingManage(true)
    try {
      const scheduledAt = toJakartaIsoString(rescheduleAt)
      const res = await fetch(`/api/public/${tenant.slug}/bookings/${manageBookingId}/reschedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: manageBookingPhone, public_token: manageBookingToken, scheduled_at: scheduledAt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menjadwalkan ulang")
      toast.success(`Booking #${data.id} dijadwalkan ulang`)
      setManageBookingId("")
      setManageBookingPhone("")
      setManageBookingToken("")
      setRescheduleAt("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menjadwalkan ulang")
    } finally {
      setLoadingManage(false)
    }
  }

  async function cancelBooking() {
    if (!manageBookingId || !manageBookingPhone || !manageBookingToken) {
      toast.error("Nomor booking, WhatsApp, dan token harus diisi")
      return
    }
    setLoadingManage(true)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/bookings/${manageBookingId}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: manageBookingPhone, public_token: manageBookingToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan booking")
      toast.success(`Booking #${data.id} dibatalkan`)
      setManageBookingId("")
      setManageBookingPhone("")
      setManageBookingToken("")
      setRescheduleAt("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan booking")
    } finally {
      setLoadingManage(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#09090b] font-sans text-zinc-100">
      <header className="border-b border-white/5 bg-[#09090b]/95 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400">{publicHost}/{tenant.slug}</p>
            <h1 className="text-xl font-bold tracking-tight text-white">{tenant.name}</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 sm:flex">
            <Clock3 className="size-4 text-emerald-400" />
            {tenant.estimated_wait_min} mnt
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{tenant.name}</h2>
            {tenant.description && <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">{tenant.description}</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric icon={<Ticket className="size-4" />} label="Antrian aktif" value={`${tenant.active_queue_count}`} />
              <Metric icon={<Clock3 className="size-4" />} label="Estimasi tunggu" value={`${tenant.estimated_wait_min} mnt`} />
              <Metric icon={<MessageCircle className="size-4" />} label="Notifikasi" value="WhatsApp" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ticket className="size-5 text-emerald-400" />
                  Ambil Antrian
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={joinQueue} className="space-y-3">
                  {tenant.operational_hours && (
                    <div className="rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                      Antrian hanya bisa diambil pada jam operasional: {tenant.operational_hours}
                    </div>
                  )}
                  <Field label="Nama">
                    <Input value={queueName} onChange={(e) => setQueueName(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                  </Field>
                  <Field label="Nomor WhatsApp">
                    <Input value={queuePhone} onChange={(e) => setQueuePhone(e.target.value)} required placeholder="6281234567890" className="border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-600" />
                  </Field>
                  <Button type="submit" className="w-full bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90" disabled={loadingQueue}>
                    {loadingQueue ? <Loader2 className="size-4 animate-spin" /> : "Ambil Nomor"}
                  </Button>
                </form>
                {queueResult && (
                  <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    Nomor kamu #{queueResult.no}. Estimasi tunggu {queueResult.estimated_wait_min} menit.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-5 text-emerald-400" />
                  Booking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createBooking} className="space-y-3">
                  <Field label="Nama">
                    <Input value={bookingName} onChange={(e) => setBookingName(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                  </Field>
                  <Field label="Nomor WhatsApp">
                    <Input value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} required placeholder="6281234567890" className="border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-600" />
                  </Field>
                  <Field label="Layanan">
                    <select
                      value={bookingServiceId}
                      onChange={(e) => setBookingServiceId(e.target.value)}
                      required
                      className="flex h-8 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-white outline-none focus:border-emerald-400/30 focus:ring-1 focus:ring-emerald-400/20"
                    >
                      <option value="">Pilih layanan</option>
                      {tenant.services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} - {service.duration_minutes} menit
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jadwal">
                    <Input type="datetime-local" value={bookingSchedule} onChange={(e) => setBookingSchedule(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                    {tenant.operational_hours && (
                      <p className="text-[10px] leading-relaxed text-zinc-500">Jam tersedia: {tenant.operational_hours}</p>
                    )}
                  </Field>
                  <Field label="Catatan">
                    <Input value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} className="border-white/10 bg-zinc-950/60 text-white" />
                  </Field>
                  <Button type="submit" className="w-full bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90" disabled={loadingBooking}>
                    {loadingBooking ? <Loader2 className="size-4 animate-spin" /> : "Buat Booking"}
                  </Button>
                </form>
                {bookingResult && (
                  <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    Booking #{bookingResult.id} dibuat. Token kelola: <span className="font-mono">{bookingResult.public_token}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-5 text-emerald-400" />
                Kelola Booking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={rescheduleBooking} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
                <Field label="Nomor Booking">
                  <Input value={manageBookingId} onChange={(e) => setManageBookingId(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                </Field>
                <Field label="Nomor WhatsApp">
                  <Input value={manageBookingPhone} onChange={(e) => setManageBookingPhone(e.target.value)} required placeholder="6281234567890" className="border-white/10 bg-zinc-950/60 text-white placeholder:text-zinc-600" />
                </Field>
                <Field label="Token">
                  <Input value={manageBookingToken} onChange={(e) => setManageBookingToken(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                </Field>
                <Field label="Jadwal Baru">
                  <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} required className="border-white/10 bg-zinc-950/60 text-white" />
                  {tenant.operational_hours && (
                    <p className="text-[10px] leading-relaxed text-zinc-500">Jam tersedia: {tenant.operational_hours}</p>
                  )}
                </Field>
                <div className="flex items-end">
                  <Button type="submit" className="w-full bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90" disabled={loadingManage}>
                    {loadingManage ? <Loader2 className="size-4 animate-spin" /> : "Ubah"}
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20" onClick={cancelBooking} disabled={loadingManage}>
                    Batal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-5 text-emerald-400" />
                QR Check-in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-white p-3">
                <Image
                  src={qrUrl}
                  alt={`QR ${tenant.name}`}
                  width={220}
                  height={220}
                  unoptimized
                  className="mx-auto aspect-square w-full max-w-[220px]"
                />
              </div>
              <p className="break-all font-mono text-xs text-emerald-400">{publicUrl}</p>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base">Info Bisnis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              {tenant.operational_hours && <p>{tenant.operational_hours}</p>}
              {tenant.services_text && <p>{tenant.services_text}</p>}
            </CardContent>
          </Card>

          {tenant.latitude !== null && tenant.longitude !== null && (
            <Card className="border-white/5 bg-zinc-900/70 text-zinc-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-5 text-emerald-400" />
                  Lokasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PublicLocationMap latitude={tenant.latitude} longitude={tenant.longitude} />
              </CardContent>
            </Card>
          )}
        </aside>
      </main>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/70 px-3 py-3">
      <div className="flex items-center gap-2 text-emerald-400">{icon}<span className="text-xs text-zinc-500">{label}</span></div>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-400">{label}</Label>
      {children}
    </div>
  )
}

function toJakartaIsoString(value: string) {
  if (!value) return ""
  return new Date(`${value}:00+07:00`).toISOString()
}
