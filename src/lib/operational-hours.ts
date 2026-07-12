export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export type TimeRange = {
  start: string
  end: string
}

export type OperationalHoursConfig = {
  timeZone?: string
  weekly?: Partial<Record<DayKey, TimeRange[]>>
}

export const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
export const DEFAULT_OPERATIONAL_HOURS_RANGE: TimeRange = { start: "06:00", end: "17:00" }
export const DEFAULT_OPERATIONAL_HOURS = JSON.stringify({
  timeZone: "Asia/Jakarta",
  weekly: Object.fromEntries(DAY_ORDER.map((day) => [day, [DEFAULT_OPERATIONAL_HOURS_RANGE]])),
} satisfies Required<OperationalHoursConfig>)

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Senin",
  tue: "Selasa",
  wed: "Rabu",
  thu: "Kamis",
  fri: "Jumat",
  sat: "Sabtu",
  sun: "Minggu",
}

export function isWithinOperationalHours(date: Date, rawConfig: string): boolean {
  const config = parseOperationalHoursConfig(rawConfig)
  if (!config) return true

  const timeZone = config.timeZone || "Asia/Jakarta"
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone })
    .format(date)
    .toLowerCase() as DayKey
  const ranges = config.weekly?.[weekday] || []
  if (ranges.length === 0) return false

  const currentMinutes = localMinutes(date, timeZone)
  return ranges.some((range) => {
    const start = parseTimeToMinutes(range.start)
    const end = parseTimeToMinutes(range.end)
    if (start === null || end === null) return false
    if (start === end) return false
    if (start < end) return currentMinutes >= start && currentMinutes < end
    return currentMinutes >= start || currentMinutes < end
  })
}

export function formatOperationalHours(rawConfig: string): string {
  const config = parseOperationalHoursConfig(rawConfig)
  if (!config?.weekly) return ""

  const daySummaries = DAY_ORDER.map((day) => {
    const ranges = config.weekly?.[day] || []
    if (ranges.length === 0) return null
    return {
      day,
      ranges: ranges.map((range) => `${range.start}-${range.end}`).join(", "),
    }
  }).filter((item): item is { day: DayKey; ranges: string } => Boolean(item))

  const groups: string[] = []
  for (let index = 0; index < daySummaries.length; index += 1) {
    const start = daySummaries[index]
    let endIndex = index
    while (
      endIndex + 1 < daySummaries.length &&
      daySummaries[endIndex + 1].ranges === start.ranges &&
      DAY_ORDER.indexOf(daySummaries[endIndex + 1].day) === DAY_ORDER.indexOf(daySummaries[endIndex].day) + 1
    ) {
      endIndex += 1
    }

    const end = daySummaries[endIndex]
    const dayLabel = start.day === end.day
      ? DAY_LABELS[start.day]
      : `${DAY_LABELS[start.day]}-${DAY_LABELS[end.day]}`
    groups.push(`${dayLabel} ${start.ranges}`)
    index = endIndex
  }

  return groups.join(", ")
}

export function parseOperationalHoursConfig(rawConfig: string): OperationalHoursConfig | null {
  try {
    const parsed = JSON.parse(rawConfig) as OperationalHoursConfig
    if (!parsed || typeof parsed !== "object" || !parsed.weekly || typeof parsed.weekly !== "object") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function normalizeOperationalHoursConfig(input: unknown): string {
  if (input === undefined || input === null || input === "") return ""

  const parsed = typeof input === "string" ? JSON.parse(input) as OperationalHoursConfig : input as OperationalHoursConfig
  if (!parsed || typeof parsed !== "object" || !parsed.weekly || typeof parsed.weekly !== "object") {
    throw new Error("invalid operational hours")
  }

  const timeZone = typeof parsed.timeZone === "string" && parsed.timeZone.trim()
    ? parsed.timeZone.trim()
    : "Asia/Jakarta"
  const weekly: Partial<Record<DayKey, TimeRange[]>> = {}

  for (const key of Object.keys(parsed.weekly)) {
    if (!isDayKey(key)) throw new Error("invalid day")
  }

  for (const day of DAY_ORDER) {
    const ranges = parsed.weekly[day]
    if (ranges === undefined) continue
    if (!Array.isArray(ranges)) throw new Error("invalid ranges")

    const normalizedRanges = ranges.map((range) => {
      if (!range || typeof range !== "object") throw new Error("invalid range")
      if (!isValidTime(range.start) || !isValidTime(range.end)) throw new Error("invalid time")
      if (range.start === range.end) throw new Error("invalid time range")
      return { start: range.start, end: range.end }
    })

    if (normalizedRanges.length > 0) weekly[day] = normalizedRanges
  }

  if (Object.keys(weekly).length === 0) return ""
  return JSON.stringify({ timeZone, weekly })
}

function isDayKey(value: string): value is DayKey {
  return DAY_ORDER.includes(value as DayKey)
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && parseTimeToMinutes(value) !== null
}

function localMinutes(date: Date, timeZone: string) {
  const localParts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date)
  const hour = Number(localParts.find((part) => part.type === "hour")?.value || 0)
  const minute = Number(localParts.find((part) => part.type === "minute")?.value || 0)
  return hour * 60 + minute
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}
