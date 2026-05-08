export interface LeadTimeEntry {
  supplierId: string
  supplierName: string
  leadTimeDays: number
  recordedAt: string
}

export interface LeadTimeHistory {
  [supplierId: string]: LeadTimeEntry[]
}

const STORAGE_KEY = "scm_lead_time_history"
const MAX_ENTRIES_PER_SUPPLIER = 12

export function loadLeadTimeHistory(): LeadTimeHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function recordLeadTime(
  supplierId: string,
  supplierName: string,
  leadTimeDays: number
): void {
  try {
    const history = loadLeadTimeHistory()
    if (!history[supplierId]) history[supplierId] = []

    const today = new Date().toISOString().split("T")[0]
    const lastEntry = history[supplierId][history[supplierId].length - 1]
    if (lastEntry) {
      const lastDate = lastEntry.recordedAt.split("T")[0]
      if (lastDate === today && lastEntry.leadTimeDays === leadTimeDays) {
        return
      }
    }

    history[supplierId].push({
      supplierId,
      supplierName,
      leadTimeDays,
      recordedAt: new Date().toISOString(),
    })

    if (history[supplierId].length > MAX_ENTRIES_PER_SUPPLIER) {
      history[supplierId] = history[supplierId].slice(-MAX_ENTRIES_PER_SUPPLIER)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {}
}

export function getLeadTimeHistory(supplierId: string): LeadTimeEntry[] {
  const history = loadLeadTimeHistory()
  return history[supplierId] ?? []
}

export function calculateLeadTimeDrift(entries: LeadTimeEntry[]): {
  baselineDays: number | null
  currentDays: number | null
  driftPercent: number | null
  driftDays: number | null
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data"
  isSignificant: boolean
} {
  if (entries.length < 2) {
    return {
      baselineDays: entries[0]?.leadTimeDays ?? null,
      currentDays: entries[0]?.leadTimeDays ?? null,
      driftPercent: null,
      driftDays: null,
      trend: "insufficient_data",
      isSignificant: false,
    }
  }

  const baseline = entries[0].leadTimeDays
  const current = entries[entries.length - 1].leadTimeDays
  const driftDays = current - baseline
  const driftPercent = Math.round((driftDays / baseline) * 100)

  let trend: "increasing" | "decreasing" | "stable"
  if (Math.abs(driftPercent) < 5) trend = "stable"
  else if (driftDays > 0) trend = "increasing"
  else trend = "decreasing"

  return {
    baselineDays: baseline,
    currentDays: current,
    driftPercent,
    driftDays,
    trend,
    isSignificant: Math.abs(driftPercent) > 20,
  }
}
