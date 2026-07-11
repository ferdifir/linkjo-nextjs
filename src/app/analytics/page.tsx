"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { ArrowLeft, Loader2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type StatusCount = {
  status: string
  count: number
}

type DailyTrend = {
  date: string
  count: number
}

type Analytics = {
  antrian_hari_ini: number
  by_status: StatusCount[]
  daily_trend: DailyTrend[]
  weekly: { total: number; avg_wait_min: number }
  total_antrian: number
  monthly: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Analytics>("/analytics")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const avgWait = data ? Math.round(data.weekly.avg_wait_min * 10) / 10 : 0

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
          <h1 className="text-lg font-bold tracking-tight text-white">Analytics</h1>
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-emerald-400">Queue Performance</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-5xl space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-500">Hari Ini</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{data.antrian_hari_ini}</p>
                </CardContent>
              </Card>
              <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-500">Rata-rata Tunggu</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{avgWait} mnt</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm text-white">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.by_status.map((s) => (
                    <div key={s.status} className="flex justify-between text-sm text-zinc-400">
                      <span className="capitalize">{s.status}</span>
                      <span className="font-medium text-emerald-400">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-zinc-900/60 text-zinc-100 shadow-lg shadow-black/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm text-white">Harian</CardTitle>
              </CardHeader>
              <CardContent>
                {data.daily_trend.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.daily_trend}>
                        <XAxis dataKey="date" fontSize={11} stroke="#71717a" tickFormatter={(v: string) => v.slice(5)} />
                        <YAxis fontSize={11} stroke="#71717a" allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Belum ada data</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Gagal memuat data
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
