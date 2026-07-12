"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Sparkles, ArrowLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { validateSlug } from "@/lib/validation"
import { publicAppHost } from "@/lib/public-url"

type Step = "phone" | "otp" | "username"
const RESERVED_SLUG_KEY = "linkjo_reserved_slug"

export default function AuthPage() {
  const router = useRouter()
  const { user, loading: authLoading, requestOTP, verifyOTP, claimUsername } = useAuth()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibleStep = user && !user.username ? "username" : step
  const publicHost = publicAppHost()

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [countdown])

  useEffect(() => {
    if (visibleStep !== "username" || username) return
    const reservedSlug = localStorage.getItem(RESERVED_SLUG_KEY)
    if (!reservedSlug) return

    const timer = setTimeout(() => {
      setUsername(reservedSlug)
    }, 0)
    return () => clearTimeout(timer)
  }, [visibleStep, username])

  useEffect(() => {
    if (authLoading || !user) return
    if (!user.username) return
    router.replace(user.setup_completed ? "/dashboard" : "/onboarding")
  }, [authLoading, router, user])

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) {
      toast.error("Nomor HP harus diisi")
      return
    }
    setLoading(true)
    try {
      await requestOTP(phone)
      setStep("otp")
      setCountdown(60)
      toast.success("Kode OTP terkirim via WhatsApp")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim OTP")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || code.length < 6) {
      toast.error("Masukkan 6 digit kode OTP")
      return
    }
    setLoading(true)
    try {
      const res = await verifyOTP(phone, code)
      if (res.needs_setup) {
        setStep("username")
      } else if (!res.setup_completed) {
        router.replace("/onboarding")
      } else {
        router.replace("/dashboard")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kode OTP salah")
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    const { slug, error } = validateSlug(username)
    if (error) {
      toast.error(error === "slug required" ? "Username harus diisi" : error)
      return
    }
    setLoading(true)
    try {
      await claimUsername(slug)
      localStorage.removeItem(RESERVED_SLUG_KEY)
      router.replace("/onboarding")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Username sudah dipakai")
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    if (step === "otp") {
      setStep("phone")
      setCode("")
    } else if (visibleStep === "username" && !user) {
      setStep("phone")
      setUsername("")
      setCode("")
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#09090b] font-sans">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[5%] size-[45vw] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[5%] size-[40vw] rounded-full bg-zinc-800/10 blur-[120px]" />
        <div className="absolute top-[30%] right-[25%] size-[25vw] rounded-full bg-emerald-400/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 sm:p-8">

        {authLoading || (user && user.username) ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/5 bg-zinc-900/70 p-8 text-emerald-400 shadow-2xl shadow-black/30">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
        <div className="animate-fade-in-up w-full max-w-[380px] space-y-5">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <svg className="size-5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {visibleStep === "phone" && "Masuk / Daftar"}
                {visibleStep === "otp" && "Verifikasi OTP"}
                {visibleStep === "username" && "Pilih Username"}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {visibleStep === "phone" && "Masuk pakai nomor WhatsApp."}
                {visibleStep === "otp" && `Kode dikirim ke ${phone || user?.phone || ""}`}
                {visibleStep === "username" && `${publicHost}/{username}`}
              </p>
            </div>
          </div>

          {/* Form container */}
          <div className="rounded-2xl border border-white/5 bg-zinc-900/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm transition-all sm:p-6">
            {visibleStep === "phone" && (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-zinc-400">
                    Nomor WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="6281234567890"
                    className="h-10 border-white/10 bg-zinc-950/60 px-3 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
                  />
                </div>

                <Button
                  className="h-10 w-full bg-emerald-400 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-[0.98]"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Kirim OTP"}
                </Button>
              </form>
            )}

            {visibleStep === "otp" && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-xs font-medium text-zinc-400">
                    Kode OTP
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    placeholder="123456"
                    className="h-11 border-white/10 bg-zinc-950/60 text-center text-lg font-bold tracking-[0.5em] text-white placeholder:text-zinc-600 focus-visible:border-emerald-400/30 focus-visible:ring-emerald-400/20"
                  />
                </div>

                <Button
                  className="h-10 w-full bg-emerald-400 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-[0.98]"
                  type="submit"
                  disabled={loading || code.length < 6}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Verifikasi"}
                </Button>

                {countdown > 0 ? (
                  <p className="text-center text-[11px] text-zinc-500">
                    Kirim ulang dalam {countdown} detik
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    className="w-full text-center text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Kirim ulang OTP
                  </button>
                )}
              </form>
            )}

            {visibleStep === "username" && (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-medium text-zinc-400">
                    Username bisnis
                  </Label>
                  <div className="flex h-10 items-center rounded-lg border border-white/10 bg-zinc-950/60 px-3 focus-within:border-emerald-400/30 focus-within:ring-1 focus-within:ring-emerald-400/20">
                    <span className="font-mono text-xs font-medium text-emerald-400 select-none shrink-0">
                      {publicHost}/
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      required
                      placeholder="nama-bisnis"
                      className="min-w-0 flex-1 border-none bg-transparent py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600">
                    Hanya huruf kecil, angka, dan tanda hubung.
                  </p>
                </div>

                <Button
                  className="h-10 w-full bg-emerald-400 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400/90 active:scale-[0.98]"
                  type="submit"
                  disabled={loading || !username.trim()}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Lanjut"}
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </form>
            )}

            {/* Back button (otp/username steps) */}
            {visibleStep !== "phone" && !user && (
              <button
                type="button"
                onClick={goBack}
                className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Kembali
              </button>
            )}
          </div>

          {/* Trust line */}
          <p className="text-center text-[10px] text-zinc-600">
            <Sparkles className="mr-1 inline size-3 text-emerald-400/60" />
            Gratis, tanpa kartu kredit.
          </p>
        </div>
        )}
      </div>
    </div>
  )
}
