import { DisruptionCategory } from "@/lib/types"
import { ScoredEvent } from "@/lib/scoreEvents"

export type { DisruptionCategory }

export interface CategoryDaySnapshot {
  date: string
  counts: Record<DisruptionCategory, number>
}

export interface CategoryTrend {
  category: DisruptionCategory
  history: number[]
  currentCount: number
  trend: "rising" | "falling" | "stable"
  changePercent: number
  sparklinePoints: string
}

const STORAGE_KEY = "scm_category_trends"
const MAX_DAYS = 7

const CATEGORIES: DisruptionCategory[] = [
  "Port", "Tariff", "Labor", "Geopolitical", "General", "Weather",
]

function countByCategory(events: ScoredEvent[]): Record<DisruptionCategory, number> {
  const counts: Record<DisruptionCategory, number> = {
    Port: 0, Tariff: 0, Labor: 0, Geopolitical: 0, General: 0, Weather: 0,
  }
  events.forEach(e => {
    const cat = e.category as DisruptionCategory
    if (cat in counts) counts[cat]++
    else counts.General++
  })
  return counts
}

export function saveCategorySnapshot(events: ScoredEvent[]): void {
  try {
    const today = new Date().toISOString().split("T")[0]
    const counts = countByCategory(events)
    const existing = loadRawHistory()

    const snapshot: CategoryDaySnapshot = { date: today, counts }
    const todayIndex = existing.findIndex(s => s.date === today)

    if (todayIndex >= 0) {
      existing[todayIndex] = snapshot
    } else {
      existing.push(snapshot)
    }

    const trimmed = existing
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_DAYS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Silently fail — non-critical feature
  }
}

export function loadRawHistory(): CategoryDaySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function buildCategoryTrends(
  currentEvents: ScoredEvent[]
): Record<DisruptionCategory, CategoryTrend> {
  const history = loadRawHistory()
  const currentCounts = countByCategory(currentEvents)

  const result = {} as Record<DisruptionCategory, CategoryTrend>

  CATEGORIES.forEach(category => {
    const historyValues: number[] = []

    if (history.length === 0) {
      historyValues.push(currentCounts[category])
    } else {
      history.forEach(snapshot => {
        historyValues.push(snapshot.counts[category] ?? 0)
      })
      // Use live count for the most recent day
      if (historyValues.length > 0) {
        historyValues[historyValues.length - 1] = currentCounts[category]
      }
    }

    const currentCount = currentCounts[category]
    const oldestCount = historyValues[0] ?? currentCount
    const maxCount = Math.max(...historyValues, 1)

    const diff = currentCount - oldestCount
    const changePercent = oldestCount > 0
      ? Math.round((diff / oldestCount) * 100)
      : 0

    let trend: CategoryTrend["trend"]
    if (Math.abs(changePercent) < 15 || historyValues.length < 3) {
      trend = "stable"
    } else if (diff > 0) {
      trend = "rising"
    } else {
      trend = "falling"
    }

    const sparklinePoints = buildSparklinePoints(historyValues, 36, 14, maxCount)

    result[category] = {
      category,
      history: historyValues,
      currentCount,
      trend,
      changePercent,
      sparklinePoints,
    }
  })

  return result
}

function buildSparklinePoints(
  values: number[],
  width: number,
  height: number,
  maxVal: number
): string {
  if (values.length === 0) return ""
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`

  const max = maxVal > 0 ? maxVal : 1
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - (v / max) * (height - 2) - 1
      return `${Math.round(x)},${Math.round(y)}`
    })
    .join(" ")
}

export function getTrendColor(trend: CategoryTrend["trend"]): {
  stroke: string
  text: string
} {
  switch (trend) {
    case "rising":  return { stroke: "#ef4444", text: "text-red-400" }
    case "falling": return { stroke: "#22c55e", text: "text-green-400" }
    case "stable":  return { stroke: "#94a3b8", text: "text-slate-400" }
  }
}
