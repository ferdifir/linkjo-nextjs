"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Star, ShieldCheck, Monitor, Smartphone, BrainCircuit, ChevronRight, Loader2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { validateSlug } from "@/lib/validation"
import { useAuth } from "@/contexts/auth-context"

const RESERVED_SLUG_KEY = "linkjo_reserved_slug"

function ProductVisual({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="relative w-full max-w-[480px]">
        <div className="relative z-0 mx-auto w-[90%] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 shadow-2xl shadow-emerald-500/5 backdrop-blur-sm animate-float-slow">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wide text-zinc-300 uppercase">linkjo console</span>
            </div>
            <span className="text-[9px] font-mono text-zinc-500">2.1.0</span>
          </div>
          <div className="p-3">
            <div className="mb-2 grid grid-cols-[24px_1fr_auto] gap-2 text-[9px] font-mono font-medium text-zinc-500">
              <span>#</span>
              <span>Nama</span>
              <span>Status</span>
            </div>
            <div className="space-y-1">
              {[
                { no: 1, name: "Marcus Chen", status: "Dipanggil", active: true },
                { no: 2, name: "Sophia Patel", status: "Selanjutnya", active: false },
                { no: 3, name: "David K.", status: "Menunggu", active: false },
                { no: 4, name: "Alex R.", status: "Menunggu", active: false },
              ].map((row) => (
                <div
                  key={row.no}
                  className={`grid grid-cols-[24px_1fr_auto] gap-2 rounded-lg px-2 py-1.5 text-[10px] ${
                    row.active ? "bg-emerald-500/10" : ""
                  }`}
                >
                  <span className="font-mono font-bold text-zinc-400">{row.no}</span>
                  <span className={`font-medium ${row.active ? "text-emerald-300" : "text-zinc-300"}`}>
                    {row.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                      row.status === "Dipanggil"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : row.status === "Selanjutnya"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/5 px-4 py-2 text-[8px] font-mono text-zinc-600">
            Rata-rata: 12min &middot; Hari ini: 47 dilayani
          </div>
        </div>

        <div className="relative -mt-24 z-10 mx-auto w-[55%] overflow-hidden rounded-[28px] border-[6px] border-zinc-800 bg-zinc-950 shadow-2xl shadow-emerald-500/10 ring-1 ring-white/5 animate-float-slower">
          <div className="absolute left-1/2 top-2 z-30 flex h-5 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-zinc-950">
            <div className="ml-16 size-2 rounded-full border border-zinc-700 bg-zinc-800" />
          </div>

          <div className="flex flex-col bg-[#09090b] pt-8">
            <div className="flex items-center justify-between bg-[#121b22] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-600 text-[8px] font-bold text-zinc-950">
                  lj
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-100">AI linkjo</div>
                  <div className="flex items-center gap-1 text-[7px] text-emerald-400">
                    <span className="size-1 rounded-full bg-emerald-400" />
                    Online
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex min-h-[130px] flex-col gap-2 bg-[#09090b] px-3 py-3"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.02) 1px, transparent 0)", backgroundSize: "16px 16px" }}
            >
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[9px] leading-relaxed text-zinc-200 shadow-sm">
                👋 Halo! Saya bisa bantu daftar antrian atau jawab pertanyaan.
              </div>
              <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[9px] leading-relaxed text-zinc-100 shadow-sm">
                Halo! Saya mau ambil nomor antrian.
              </div>
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[9px] leading-relaxed text-zinc-200 shadow-sm">
                Kamu nomor #3. Estimasi tunggu: 12 menit. ☕
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#1f2c34] px-2 py-1.5">
              <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[8px] text-zinc-500">
                Ketik pesan...
              </div>
              <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500">
                <svg className="size-3 text-zinc-950 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [activeFeature, setActiveFeature] = useState(0)
  const [slug, setSlug] = useState("")
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [slugMessage, setSlugMessage] = useState("Gratis, tanpa kartu kredit.")
  const [slugMessageTone, setSlugMessageTone] = useState<"neutral" | "error">("neutral")
  const [availableSlug, setAvailableSlug] = useState("")
  const [showSignupDialog, setShowSignupDialog] = useState(false)
  const userInteracted = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      if (userInteracted.current) return
      setActiveFeature((prev) => (prev + 1) % 3)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const handleFeatureClick = (i: number) => {
    userInteracted.current = true
    setActiveFeature(i)
  }

  const setSlugInfo = (message: string, tone: "neutral" | "error" = "neutral") => {
    setSlugMessage(message)
    setSlugMessageTone(tone)
  }

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase())
    setAvailableSlug("")
    setSlugInfo("Gratis, tanpa kartu kredit.")
  }

  const handleReserveUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    const { slug: candidate, error } = validateSlug(slug)

    if (error) {
      setSlugInfo(error === "slug required" ? "Masukkan nama URL bisnis terlebih dahulu." : error, "error")
      return
    }

    setCheckingSlug(true)
    setSlugInfo(`Mengecek linkjo.co/${candidate}...`)

    try {
      const res = await fetch(`/api/slugs/availability?slug=${encodeURIComponent(candidate)}`)
      const data = await res.json()

      if (!res.ok) {
        setSlugInfo(data.error || "Gagal mengecek URL. Coba lagi.", "error")
        return
      }

      if (data.available) {
        setAvailableSlug(candidate)
        setShowSignupDialog(true)
        setSlugInfo(`linkjo.co/${candidate} tersedia.`)
      } else {
        setSlugInfo(`linkjo.co/${candidate} sudah digunakan.`, "error")
      }
    } catch {
      setSlugInfo("Gagal mengecek URL. Coba lagi.", "error")
    } finally {
      setCheckingSlug(false)
    }
  }

  const handleSignupWithSlug = () => {
    if (availableSlug) {
      localStorage.setItem(RESERVED_SLUG_KEY, availableSlug)
    }
    router.push("/auth")
  }

  const handleEnterApp = () => {
    if (authLoading) return
    if (user) {
      router.push(user.setup_completed ? "/dashboard" : "/onboarding")
      return
    }
    router.push("/auth")
  }

  const features = [
    {
      title: "Check-in via WhatsApp",
      badge: "Tanpa Aplikasi",
      desc: "Pelanggan masuk antrian dalam 3 detik dengan scan QR code atau klik link. Tidak perlu download aplikasi.",
      icon: <Smartphone className="size-4 text-emerald-400" />,
      accent: "border-emerald-400/20 text-emerald-400 bg-emerald-500/5",
    },
    {
      title: "AI Percakapan",
      badge: "Otomatis 24/7",
      desc: "AI jawab pertanyaan, atur penundaan, booking, dan kirim notifikasi otomatis tanpa perlu staf.",
      icon: <BrainCircuit className="size-4 text-emerald-400" />,
      accent: "border-emerald-400/20 text-emerald-400 bg-emerald-500/5",
    },
    {
      title: "Konsol Merchant",
      badge: "Kirim Instan",
      desc: "Panggil pelanggan berikutnya sekali klik. Kirim alert WhatsApp otomatis 'Giliran Anda siap!' secara real-time.",
      icon: <Monitor className="size-4 text-emerald-400" />,
      accent: "border-emerald-400/20 text-emerald-400 bg-emerald-500/5",
    },
  ]

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-[#09090b] font-sans text-zinc-100">
      {/* Background radial blobs */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[5%] size-[45vw] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[5%] size-[40vw] rounded-full bg-zinc-800/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[25%] size-[25vw] rounded-full bg-emerald-400/5 blur-[100px]" />
      </div>

      {/* Navbar */}
      <header className="flex w-full items-center justify-between border-b border-white/5 bg-[#09090b]/90 px-4 py-4 backdrop-blur-md z-40 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <svg className="size-5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white leading-none">linkjo</span>
            <span className="font-mono text-[10px] font-medium tracking-widest text-emerald-400 uppercase mt-0.5">queue.ai</span>
          </div>
        </div>

        <Button
          className="h-9 bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-100 active:scale-95"
          onClick={handleEnterApp}
          disabled={authLoading}
        >
          {authLoading ? "Mengecek..." : user ? "Buka Dashboard" : "Masuk / Daftar"}
          <ChevronRight className="ml-0.5 size-3.5 stroke-[2.5]" />
        </Button>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 w-full max-w-7xl mx-auto flex-col gap-2 overflow-hidden px-4 py-2 sm:px-6 sm:py-6 md:flex-row md:gap-6">
        {/* Left panel */}
        <div className="relative isolate flex h-full w-full flex-col justify-between overflow-hidden pr-0 md:w-[45%] md:pr-4">
          {/* Hero + Form centered in remaining space */}
          <div className="relative z-20 flex flex-1 flex-col justify-start gap-3 overflow-hidden pt-3 md:justify-center md:gap-5 md:pt-0">
          {/* Hero text */}
          <div className="flex flex-col gap-2 md:gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/5 bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 px-3 py-1.5 md:px-3 shadow-lg">
              <Star className="size-3.5 fill-emerald-400 text-emerald-400 md:size-3.5" />
              <span className="font-medium text-xs tracking-wide text-zinc-300 md:text-[10.5px]">
                Sistem antrian tanpa gesekan.
              </span>
            </div>

            <h1 className="text-2xl font-bold leading-[1.1] tracking-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
              Antrian dikelola{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text font-extrabold text-transparent">
                AI
              </span>
              .<br />
              Dikirim lewat WhatsApp.
            </h1>

            <p className="text-xs font-normal leading-relaxed text-zinc-400 sm:text-xs md:text-sm">
              Pelanggan tidak perlu duduk di ruang tunggu atau download aplikasi. Dengan{" "}
              <strong className="font-medium text-white">linkjo</strong>, mereka scan QR code, join via WhatsApp, dan ngopi dulu. AI kami handle check-in, reschedule, FAQ, dan notifikasi otomatis.
            </p>
          </div>

          {/* Reserve URL form */}
          <form onSubmit={handleReserveUrl} className="w-full">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/40 p-2.5 shadow-lg transition-all focus-within:border-emerald-400/30 focus-within:ring-1 focus-within:ring-emerald-400/20 md:rounded-2xl md:p-2.5">
              <div className="flex min-w-0 flex-1 items-center pl-1">
                <span className="font-mono text-xs font-medium text-emerald-400 select-none md:text-xs">linkjo.co/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="nama-bisnis"
                  className="min-w-0 flex-1 border-none bg-transparent p-1 text-xs font-semibold text-white outline-none placeholder:text-zinc-600 md:text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={checkingSlug}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-95 disabled:pointer-events-none disabled:opacity-70 md:rounded-xl md:px-4 md:py-2.5 md:text-xs"
              >
                <span>{checkingSlug ? "Mengecek" : "Pesan URL"}</span>
                {checkingSlug ? (
                  <Loader2 className="size-3.5 animate-spin stroke-[2.5] md:size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5 stroke-[2.5] md:size-3.5" />
                )}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1.5">
              <div className={`flex items-center gap-1.5 text-[10px] font-medium md:text-[10px] ${slugMessageTone === "error" ? "text-red-400" : "text-zinc-500"}`}>
                <ShieldCheck className={`size-3.5 md:size-3.5 ${slugMessageTone === "error" ? "text-red-400" : "text-emerald-400"}`} />
                <span>{slugMessage}</span>
              </div>
            </div>
          </form>
        </div>

          <ProductVisual className="pointer-events-none relative z-0 -my-8 flex h-[210px] w-full items-center justify-center overflow-visible opacity-75 md:hidden" />

          {/* Feature cards */}
          <div className="relative z-20 flex flex-col gap-2 border-t border-white/5 pt-2 md:gap-3 md:pt-3">
            <span className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase md:text-[10px]">
              Kemampuan Platform:
            </span>
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {features.map((f, i) => {
                const active = activeFeature === i
                return (
                  <button
                    key={i}
                    onClick={() => handleFeatureClick(i)}
                    className={`flex cursor-pointer flex-col justify-between gap-1 rounded-lg border p-2 text-left transition-all duration-300 md:gap-1.5 md:rounded-xl md:p-2.5 ${
                      active
                        ? "border-emerald-400/30 bg-zinc-900 shadow-lg shadow-emerald-500/5"
                        : "border-white/5 bg-zinc-950/20 hover:border-white/10"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="shrink-0 rounded-md border border-white/10 bg-zinc-950 p-1 md:rounded-lg">
                        {f.icon}
                      </div>
                      <span className={`shrink-0 scale-75 rounded-full border px-1 py-0.5 font-mono text-[8px] md:scale-90 md:px-1.5 md:text-[8.5px] ${f.accent}`}>
                        {f.badge}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold leading-tight md:text-xs ${active ? "text-white" : "text-zinc-400"}`}>
                      {f.title}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Active feature description */}
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950/40 p-2 flex flex-col justify-center min-h-[44px] md:min-h-[85px] md:rounded-2xl md:p-3.5">
              <p className="text-xs font-medium leading-relaxed text-slate-300 md:text-[11.5px]">
                {features[activeFeature].desc}
              </p>
            </div>
          </div>
        </div>

        <ProductVisual className="relative hidden h-full w-full items-center justify-center p-8 md:flex md:w-[55%]" />
      </main>

      {/* Footer */}
      <footer className="z-20 w-full border-t border-white/5 bg-[#09090b] py-2 text-center font-mono text-[10px] tracking-wider text-zinc-500">
        <span>&copy; 2026 LINKJO — SISTEM ANTRIAN PINTAR VIA WHATSAPP</span>
      </footer>

      {showSignupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-emerald-500/10">
            <div className="space-y-2">
              <p className="font-mono text-xs font-medium text-emerald-400">linkjo.co/{availableSlug}</p>
              <h2 className="text-lg font-bold tracking-tight text-white">URL tersedia</h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                Daftar sekarang untuk mengaktifkan halaman publik antrian dan booking bisnis ini.
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSignupDialog(false)}
                className="h-10 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Nanti
              </button>
              <button
                type="button"
                onClick={handleSignupWithSlug}
                className="h-10 flex-1 rounded-lg bg-emerald-400 px-4 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400/90"
              >
                Daftar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
