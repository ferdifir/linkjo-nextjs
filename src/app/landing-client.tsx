"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { LogoLockup } from "@/components/logo"
import { Star, ShieldCheck, Monitor, Smartphone, BrainCircuit, ChevronRight, Loader2, CheckCircle2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { validateSlug } from "@/lib/validation"
import { useAuth } from "@/contexts/auth-context"
import { publicAppHost } from "@/lib/public-url"

const RESERVED_SLUG_KEY = "linkjo_reserved_slug"

function formatBusinessName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const productVisualScenes = [
  {
    image: "/landing/cutouts/check-in-whatsapp.png",
    alt: "Pelanggan memindai QR code di meja barbershop untuk mengambil nomor antrean melalui halaman Linkjo.",
    width: 618,
    height: 1024,
  },
  {
    image: "/landing/cutouts/ai-conversation.png",
    alt: "Ilustrasi AI WhatsApp assistant yang menangani FAQ, booking, reschedule, dan reminder.",
    width: 1084,
    height: 1023,
  },
  {
    image: "/landing/cutouts/merchant-console.png",
    alt: "Operator bisnis memakai konsol antrean untuk memanggil pelanggan berikutnya dan mengirim alert WhatsApp.",
    width: 972,
    height: 1024,
  },
]

function ProductVisual({ className, activeFeature }: { className: string; activeFeature: number }) {
  const scene = productVisualScenes[activeFeature] ?? productVisualScenes[0]

  return (
    <div className={className}>
      <div className="relative flex h-full min-h-[260px] w-full max-w-[660px] items-center justify-center overflow-visible">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-[8%] h-[18%] w-[62%] rounded-full bg-emerald-500/10 blur-[38px]" />
        <Image
          key={scene.image}
          src={scene.image}
          alt={scene.alt}
          width={scene.width}
          height={scene.height}
          priority={activeFeature === 0}
          className="relative z-10 h-full max-h-[560px] w-auto max-w-full object-contain drop-shadow-[0_32px_60px_rgba(16,185,129,0.16)] animate-fade-in"
        />
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [activeFeature, setActiveFeature] = useState(0)
  const [slug, setSlug] = useState("")
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [slugMessage, setSlugMessage] = useState("Pelanggan membuka URL ini untuk booking atau mengambil nomor antrean.")
  const [slugMessageTone, setSlugMessageTone] = useState<"neutral" | "error">("neutral")
  const [availableSlug, setAvailableSlug] = useState("")
  const [showSignupDialog, setShowSignupDialog] = useState(false)
  const userInteracted = useRef(false)
  const publicHost = publicAppHost()

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
    setSlugInfo("Pelanggan membuka URL ini untuk booking atau mengambil nomor antrean.")
  }

  const handleReserveUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    const { slug: candidate, error } = validateSlug(slug)

    if (error) {
      setSlugInfo(error === "slug required" ? "Masukkan nama URL bisnis terlebih dahulu." : error, "error")
      return
    }

    setCheckingSlug(true)
    setSlugInfo(`Mengecek ${publicHost}/${candidate}...`)

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
        setSlugInfo(`${publicHost}/${candidate} tersedia.`)
      } else {
        setSlugInfo(`${publicHost}/${candidate} sudah digunakan.`, "error")
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
        <LogoLockup />

        <div className="flex items-center gap-2">
          {!user && (
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="hidden h-9 cursor-pointer items-center px-3 text-xs font-medium text-zinc-400 transition-colors hover:text-white sm:inline-flex"
            >
              Masuk
            </button>
          )}
          <Button
            className="h-9 bg-white px-4 text-xs font-medium text-zinc-950 hover:bg-zinc-100 active:scale-95"
            onClick={handleEnterApp}
          >
            {user ? "Buka Dashboard" : "Mulai Gratis"}
            <ChevronRight className="ml-0.5 size-3.5 stroke-[2.5]" />
          </Button>
        </div>
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
            <div className="mb-2 px-1">
              <label htmlFor="business-slug" className="text-xs font-bold tracking-wide text-white">
                Buat halaman antrean bisnismu
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/40 p-2.5 shadow-lg transition-all focus-within:border-emerald-400/30 focus-within:ring-1 focus-within:ring-emerald-400/20 md:rounded-2xl md:p-2.5">
              <div className="flex min-w-0 flex-1 items-center pl-1">
                <span className="font-mono text-xs font-medium text-emerald-400 select-none md:text-xs">{publicHost}/</span>
                <input
                  id="business-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="nama-klinik, barbershop-andi, atau bengkel-maju"
                  className="min-w-0 flex-1 border-none bg-transparent p-1 text-xs font-semibold text-white outline-none placeholder:text-zinc-600 md:text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={checkingSlug}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-95 disabled:pointer-events-none disabled:opacity-70 md:rounded-xl md:px-4 md:py-2.5 md:text-xs"
              >
                <span>{checkingSlug ? "Mengecek" : "Cek URL"}</span>
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

          <ProductVisual
            activeFeature={activeFeature}
            className="pointer-events-none relative z-0 -my-8 flex h-[210px] w-full items-center justify-center overflow-visible opacity-75 md:hidden"
          />

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

        <ProductVisual activeFeature={activeFeature} className="relative hidden h-full w-full items-center justify-center p-8 md:flex md:w-[55%]" />
      </main>

      {/* Footer */}
      <footer className="z-20 w-full border-t border-white/5 bg-[#09090b] py-2 text-center font-mono text-[10px] tracking-wider text-zinc-500">
        <span>&copy; 2026 LINKJO — SISTEM ANTRIAN PINTAR VIA WHATSAPP</span>
      </footer>

      {showSignupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-emerald-500/10">
            <div className="space-y-2">
              <p className="font-mono text-xs font-medium text-emerald-400">{publicHost}/{availableSlug}</p>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <h2 className="text-lg font-bold tracking-tight text-white">URL ini tersedia</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                Klaim URL ini untuk membuat halaman publik tempat pelanggan mengambil antrean atau melakukan booking melalui WhatsApp.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-sm font-black text-zinc-950">
                  {formatBusinessName(availableSlug).slice(0, 2) || "LJ"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{formatBusinessName(availableSlug) || "Nama Bisnis"}</p>
                  <p className="text-xs text-zinc-500">{publicHost}/{availableSlug}</p>
                </div>
              </div>
              <div className="mb-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                <p className="text-[11px] font-medium text-zinc-400">Antrean saat ini</p>
                <p className="text-sm font-bold text-emerald-300">4 orang menunggu</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-400 px-3 py-2 text-center text-[11px] font-bold text-zinc-950">
                  Ambil Nomor Antrean
                </div>
                <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-center text-[11px] font-bold text-zinc-200">
                  Booking Jadwal
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-zinc-500">Gratis, tanpa kartu kredit.</p>
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
                Klaim dan daftar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
