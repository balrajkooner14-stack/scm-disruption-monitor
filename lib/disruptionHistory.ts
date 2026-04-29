import { ScoredEvent } from "@/lib/scoreEvents"

export interface HistoryEntry {
  id: string
  title: string
  category: string
  region: string
  severity: number
  severityLabel: string
  sourceDomain: string
  eventUrl: string
  isProfileMatch: boolean
  relevanceScore: number
  relevanceReason: string
  savedAt: string
  date: string
}

const STORAGE_KEY = "scm_disruption_history"
const MAX_ENTRIES = 500
const RETENTION_DAYS = 90

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const entries: HistoryEntry[] = JSON.parse(raw)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    return entries
      .filter(e => new Date(e.savedAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  } catch {
    return []
  }
}

export function saveEventsToHistory(events: ScoredEvent[]): void {
  try {
    const existing = loadHistory()
    const existingIds = new Set(existing.map(e => e.id))

    const toSave = events.filter(e => e.severity >= 2 || e.isProfileMatch)

    const now = new Date()
    const dateStr = now.toISOString().split("T")[0]
    const savedAtStr = now.toISOString()

    const newEntries: HistoryEntry[] = []

    toSave.forEach(event => {
      const id = `${btoa(event.url).slice(0, 16)}-${dateStr}`
      if (existingIds.has(id)) return

      newEntries.push({
        id,
        title: event.title,
        category: event.category,
        region: event.region,
        severity: event.severity,
        severityLabel:
          event.severity === 3 ? "CRITICAL" : event.severity === 2 ? "WARNING" : "MONITOR",
        sourceDomain: event.sourceDomain ?? "",
        eventUrl: event.url,
        isProfileMatch: event.isProfileMatch,
        relevanceScore: event.relevanceScore,
        relevanceReason: event.relevanceReason ?? "",
        savedAt: savedAtStr,
        date: dateStr,
      })
    })

    if (newEntries.length === 0) return

    const merged = [...newEntries, ...existing].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Silently fail — logging is non-critical
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function exportHistoryAsCSV(entries: HistoryEntry[]): void {
  const headers = [
    "Date",
    "Title",
    "Category",
    "Region",
    "Severity",
    "Profile Match",
    "Relevance Score",
    "Source",
    "URL",
    "Saved At",
  ]

  const rows = entries.map(e => [
    e.date,
    `"${e.title.replace(/"/g, '""')}"`,
    e.category,
    e.region,
    e.severityLabel,
    e.isProfileMatch ? "Yes" : "No",
    e.relevanceScore.toString(),
    e.sourceDomain,
    e.eventUrl,
    e.savedAt,
  ])

  const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  const dateStr = new Date().toISOString().split("T")[0]
  link.download = `scm-disruption-history-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function groupEntriesByMonth(
  entries: HistoryEntry[]
): Array<{ monthLabel: string; entries: HistoryEntry[] }> {
  const groups = new Map<string, HistoryEntry[]>()

  entries.forEach(entry => {
    const date = new Date(entry.savedAt)
    const key = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    })
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(entry)
  })

  return Array.from(groups.entries()).map(([monthLabel, monthEntries]) => ({
    monthLabel,
    entries: monthEntries,
  }))
}
