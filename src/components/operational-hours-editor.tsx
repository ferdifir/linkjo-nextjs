"use client"

import { Clock3, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { DayKey, OperationalHoursConfig, TimeRange } from "@/lib/operational-hours"

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
]

const EMPTY_WEEKLY: Record<DayKey, TimeRange[]> = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
}

const DEFAULT_RANGE = { start: "06:00", end: "17:00" }

export function OperationalHoursEditor({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const config = parseValue(value)

  function commit(next: Required<Pick<OperationalHoursConfig, "timeZone">> & { weekly: Record<DayKey, TimeRange[]> }) {
    const compactWeekly = Object.fromEntries(
      DAYS.map(({ key }) => [key, next.weekly[key] || []]).filter(([, ranges]) => (ranges as TimeRange[]).length > 0),
    )

    if (Object.keys(compactWeekly).length === 0) {
      onChange("")
      return
    }

    onChange(JSON.stringify({ timeZone: next.timeZone, weekly: compactWeekly }))
  }

  function setDayEnabled(day: DayKey, enabled: boolean) {
    commit({
      ...config,
      weekly: {
        ...config.weekly,
        [day]: enabled ? [DEFAULT_RANGE] : [],
      },
    })
  }

  function setTime(day: DayKey, rangeIndex: number, field: keyof TimeRange, nextValue: string) {
    const ranges = config.weekly[day].length > 0 ? config.weekly[day] : [DEFAULT_RANGE]
    const nextRanges = ranges.map((range, index) => (
      index === rangeIndex ? { ...range, [field]: nextValue } : range
    ))
    commit({
      ...config,
      weekly: {
        ...config.weekly,
        [day]: nextRanges,
      },
    })
  }

  function addRange(day: DayKey) {
    commit({
      ...config,
      weekly: {
        ...config.weekly,
        [day]: [...config.weekly[day], DEFAULT_RANGE],
      },
    })
  }

  function removeRange(day: DayKey, rangeIndex: number) {
    const nextRanges = config.weekly[day].filter((_, index) => index !== rangeIndex)
    commit({
      ...config,
      weekly: {
        ...config.weekly,
        [day]: nextRanges,
      },
    })
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Clock3 className="size-4 text-emerald-400" />
        <div>
          <Label className="text-xs font-medium text-zinc-400">Jam Operasional</Label>
          <p className="text-[10px] text-zinc-600">Booking hanya bisa dipilih pada hari dan jam ini.</p>
        </div>
      </div>

      <div className="grid gap-2">
        {DAYS.map((day) => {
          const enabled = config.weekly[day.key].length > 0
          const ranges = enabled ? config.weekly[day.key] : [DEFAULT_RANGE]

          return (
            <div
              key={day.key}
              className={cn(
                "rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2",
                !enabled && "opacity-60",
              )}
            >
              <div className="grid grid-cols-[88px_1fr] items-start gap-2">
                <label className="flex h-9 items-center gap-2 text-xs font-medium text-zinc-300">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setDayEnabled(day.key, event.target.checked)}
                    className="size-4 rounded border-white/10 bg-zinc-950 accent-emerald-400"
                  />
                  {day.label}
                </label>
                <div className="space-y-2">
                  {ranges.map((range, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        type="time"
                        value={range.start}
                        onChange={(event) => setTime(day.key, index, "start", event.target.value)}
                        disabled={!enabled}
                        className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white"
                      />
                      <Input
                        type="time"
                        value={range.end}
                        onChange={(event) => setTime(day.key, index, "end", event.target.value)}
                        disabled={!enabled}
                        className="h-9 border-white/10 bg-zinc-950/60 text-sm text-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:bg-red-500/10"
                        disabled={!enabled || ranges.length === 1}
                        onClick={() => removeRange(day.key, index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {enabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => addRange(day.key)}
                    >
                      <Plus className="size-3.5" />
                      Tambah Jam
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function parseValue(value: string): Required<Pick<OperationalHoursConfig, "timeZone">> & { weekly: Record<DayKey, TimeRange[]> } {
  const fallback = {
    timeZone: "Asia/Jakarta",
    weekly: { ...EMPTY_WEEKLY },
  }

  if (!value) return fallback

  try {
    const parsed = JSON.parse(value) as OperationalHoursConfig
    const weekly = { ...EMPTY_WEEKLY }

    for (const { key } of DAYS) {
      const ranges = parsed.weekly?.[key] || []
      weekly[key] = ranges
        .filter((range) => range?.start && range?.end)
        .map((range) => ({ start: range.start, end: range.end }))
    }

    return {
      timeZone: parsed.timeZone || "Asia/Jakarta",
      weekly,
    }
  } catch {
    return fallback
  }
}
