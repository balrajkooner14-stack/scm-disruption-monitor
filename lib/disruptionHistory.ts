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
