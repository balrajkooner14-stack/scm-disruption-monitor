export interface LeadTimeEntry {
  supplierId: string
  supplierName: string
  leadTimeDays: number
  recordedAt: string
}

export interface LeadTimeHistory {
  [supplierId: string]: LeadTimeEntry[]
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
