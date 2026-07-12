"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Plus, Check, X, CheckCheck, BarChart3, Settings, LogOut, Loader2, CalendarClock } from "lucide-react"
import { toast } from "sonner"

type QueueItem = {
  no: number
  nama: string
  phone?: string | null
  status: string
  created_at: string
}

type BookingItem = {
  id: string
  customer_name: string
  phone: string
  service: string
  service_duration_minutes: number
  scheduled_at: string
  notes?: string
  status: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { logout } = useAuth()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [adding, setAdding] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchQueue() {
    try {
      const data = await api<QueueItem[]>("/queue")
      setQueue(data)
    } catch {
      // handled by api.ts 401 redirect
    }
  }

  async function fetchBookings() {
    try {
      const data = await api<BookingItem[]>("/bookings")
      setBookings(data)
    } catch {
      // handled by api.ts 401 redirect
    }
  }

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchQueue()
      fetchBookings()
    }, 0)
    intervalRef.current = setInterval(() => {
      fetchQueue()
      fetchBookings()
    }, 3000)
    return () => {
      clearTimeout(initialFetch)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function addQueue() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await api("/queue", { method: "POST", body: JSON.stringify({ nama: newName.trim(), phone: newPhone.trim() || undefined }) })
      setNewName("")
      setNewPhone("")
      setShowAdd(false)
      await fetchQueue()
    } catch {
      toast.error("Gagal menambah antrian")
    } finally {
      setAdding(false)
    }
  }

  async function panggil(no: number) {
    try {
      await api(`/queue/${no}/panggil`, { method: "PUT" })
      await fetchQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memanggil antrian")
    }
  }

  async function selesai(no: number) {
    try {
      await api(`/queue/${no}/selesai`, { method: "PUT" })
      await fetchQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyelesaikan antrian")
    }
  }

  async function batalkan(no: number) {
    try {
      await api(`/queue/${no}/batalkan`, { method: "PUT" })
      await fetchQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan antrian")
    }
  }

  async function confirmBooking(id: string) {
    try {
      await api(`/bookings/${id}/confirm`, { method: "PUT" })
      await fetchBookings()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menerima booking")
    }
  }

  async function cancelBooking(id: string) {
    try {
      await api(`/bookings/${id}/cancel`, { method: "PUT" })
      await fetchBookings()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan booking")
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "menunggu": return "border-amber-400/30 bg-amber-500/10 text-amber-300"
      case "dipanggil": return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      case "selesai": return "border-zinc-500/30 bg-zinc-800 text-zinc-300"
      case "batal": return "border-red-400/30 bg-red-500/10 text-red-300"
      default: return "border-zinc-500/30 bg-zinc-800 text-zinc-300"
    }
  }

  const waiting = queue.filter((q) => q.status === "menunggu").length
  const called = queue.filter((q) => q.status === "dipanggil").length
  const pendingBookings = bookings.filter((booking) => booking.status === "pending" || booking.status === "rescheduled")
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed")

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

      <header className="relative z-10 flex items-center justify-between border-b border-white/5 bg-[#09090b]/90 px-4 py-3 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Linkjo</h1>
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400">Queue Console</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" onClick={() => router.push("/analytics")}>
            <BarChart3 className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" onClick={() => router.push("/settings")}>
            <Settings className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-white/5 hover:text-white" onClick={handleLogout}>
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <div className="relative z-10 border-b border-white/5 px-4 py-3">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between text-xs font-medium text-zinc-500">
          <span>{waiting} menunggu, {called} dipanggil</span>
          <span>{queue.length} antrian, {pendingBookings.length} pending, {confirmedBookings.length} diterima</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <div className="mx-auto w-full max-w-5xl space-y-2">
        {queue.length === 0 && (
          <div className="flex min-h-[45vh] items-center justify-center rounded-2xl border border-white/5 bg-zinc-900/30 text-sm text-zinc-500">
            Belum ada antrian
          </div>
        )}

        {queue.map((q) => (
          <Card key={q.no} className="flex items-center gap-3 border-white/5 bg-zinc-900/60 px-4 py-3 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${statusColor(q.status)}`}>
              {q.no}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-white">{q.nama}</p>
              <p className="text-xs capitalize text-zinc-500">{q.status}{q.phone ? ` - ${q.phone}` : ""}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {q.status === "menunggu" && (
                <>
                  <Button variant="ghost" size="icon" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => panggil(q.no)}>
                    <Check className="size-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={() => batalkan(q.no)}>
                    <X className="size-5" />
                  </Button>
                </>
              )}
              {q.status === "dipanggil" && (
                <Button variant="ghost" size="icon" className="text-emerald-300 hover:bg-emerald-500/10" onClick={() => selesai(q.no)}>
                  <CheckCheck className="size-5" />
                </Button>
              )}
            </div>
          </Card>
        ))}

        {pendingBookings.length > 0 && (
          <div className="pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Permintaan Booking</h2>
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
                {pendingBookings.length} perlu keputusan
              </span>
            </div>
            <div className="space-y-2">
              {pendingBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  tone="pending"
                  primaryLabel="Terima"
                  onPrimary={() => confirmBooking(booking.id)}
                  onCancel={() => cancelBooking(booking.id)}
                />
              ))}
            </div>
          </div>
        )}

        {confirmedBookings.length > 0 && (
          <div className="pt-4">
            <h2 className="mb-2 text-sm font-semibold text-white">Booking Diterima</h2>
            <div className="space-y-2">
              {confirmedBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  tone="confirmed"
                  onCancel={() => cancelBooking(booking.id)}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {showAdd && (
        <div className="relative z-10 border-t border-white/5 bg-[#09090b]/90 px-4 py-3 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addQueue()
            }}
            className="mx-auto flex w-full max-w-5xl gap-2"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama pelanggan"
              autoFocus
              className="border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
            />
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="WhatsApp"
              className="border-white/10 bg-zinc-950/60 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
            />
            <Button className="bg-emerald-400 font-bold text-zinc-950 hover:bg-emerald-400/90" type="submit" disabled={adding}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : "Tambah"}
            </Button>
            <Button variant="outline" className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => setShowAdd(false)}>
              Batal
            </Button>
          </form>
        </div>
      )}

      {!showAdd && (
        <div className="relative z-10 px-4 py-3">
          <div className="mx-auto w-full max-w-5xl">
          <Button className="w-full bg-emerald-400 font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400/90" onClick={() => setShowAdd(true)}>
            <Plus className="size-4 mr-2" />
            Tambah Antrian
          </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function BookingCard({
  booking,
  tone,
  primaryLabel,
  onPrimary,
  onCancel,
}: {
  booking: BookingItem
  tone: "pending" | "confirmed"
  primaryLabel?: string
  onPrimary?: () => void
  onCancel: () => void
}) {
  const statusClass = tone === "pending"
    ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
    : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"

  return (
    <Card className="flex items-center gap-3 border-white/5 bg-zinc-900/60 px-4 py-3 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${statusClass}`}>
        <CalendarClock className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-white">{booking.customer_name}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>
            {booking.status}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          {booking.service} ({booking.service_duration_minutes} mnt) - {new Date(booking.scheduled_at).toLocaleString("id-ID")}
        </p>
        <p className="text-xs text-zinc-600">{booking.phone}{booking.notes ? ` - ${booking.notes}` : ""}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        {onPrimary && (
          <Button variant="ghost" size="sm" className="text-emerald-400 hover:bg-emerald-500/10" onClick={onPrimary}>
            <Check className="size-4" />
            {primaryLabel}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={onCancel}>
          <X className="size-5" />
        </Button>
      </div>
    </Card>
  )
}
