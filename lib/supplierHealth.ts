import { Supplier } from "@/lib/profile"

export interface SupplierHealthEntry {
  supplierId: string
  supplierName: string
  onTimeDeliveryRate: number    // 0-100 percentage
  qualityScore: number          // 0-100 percentage
  lastShipmentDelayDays: number // 0 = on time, negative = early
  notes: string                 // free text field
  updatedAt: string             // ISO date string
}

export interface SupplierHealthScore {
  supplierId: string
  supplierName: string
  compositeScore: number        // 0-100 calculated
  grade: "Excellent" | "Good" | "Fair" | "Poor" | "Critical"
  gradeColor: string            // tailwind text color class
  gradeBg: string               // tailwind bg color class
  gradeBorder: string           // tailwind border color class
  onTimeDeliveryRate: number
  qualityScore: number
  lastShipmentDelayDays: number
  notes: string
  updatedAt: string
  hasData: boolean              // false if no entry logged yet
}

const STORAGE_KEY = "scm_supplier_health"

// Weighted: on-time delivery 50%, quality 35%, delay penalty 15%
export function calculateCompositeScore(entry: SupplierHealthEntry): number {
  const onTimePoints = entry.onTimeDeliveryRate * 0.5
  const qualityPoints = entry.qualityScore * 0.35

  // 0 days delay = 15 points, each day late = -1.5 points, cap at 0
  const delayPenalty = Math.max(0, entry.lastShipmentDelayDays)
  const delayPoints = Math.max(0, 15 - delayPenalty * 1.5)

  return Math.round(Math.min(100, onTimePoints + qualityPoints + delayPoints))
}

export function getGrade(score: number): {
  grade: SupplierHealthScore["grade"]
  gradeColor: string
  gradeBg: string
  gradeBorder: string
} {
  if (score >= 85)
    return {
      grade: "Excellent",
      gradeColor: "text-green-400",
      gradeBg: "bg-green-950",
      gradeBorder: "border-green-700",
    }
  if (score >= 70)
    return {
      grade: "Good",
      gradeColor: "text-blue-400",
      gradeBg: "bg-blue-950",
      gradeBorder: "border-blue-700",
    }
  if (score >= 55)
    return {
      grade: "Fair",
      gradeColor: "text-amber-400",
      gradeBg: "bg-amber-950",
      gradeBorder: "border-amber-700",
    }
  if (score >= 40)
    return {
      grade: "Poor",
      gradeColor: "text-orange-400",
      gradeBg: "bg-orange-950",
      gradeBorder: "border-orange-700",
    }
  return {
    grade: "Critical",
    gradeColor: "text-red-400",
    gradeBg: "bg-red-950",
    gradeBorder: "border-red-700",
  }
}

export function loadHealthEntries(): Record<string, SupplierHealthEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveHealthEntry(entry: SupplierHealthEntry): void {
  try {
    const all = loadHealthEntries()
    all[entry.supplierId] = entry
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Silently fail
  }
}

export function buildHealthScores(suppliers: Supplier[]): SupplierHealthScore[] {
  const entries = loadHealthEntries()

  return suppliers.map(supplier => {
    const entry = entries[supplier.id]

    if (!entry) {
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        compositeScore: 0,
        grade: "Fair" as const,
        gradeColor: "text-slate-400",
        gradeBg: "bg-slate-800",
        gradeBorder: "border-slate-700",
        onTimeDeliveryRate: 0,
        qualityScore: 0,
        lastShipmentDelayDays: 0,
        notes: "",
        updatedAt: "",
        hasData: false,
      }
    }

    const compositeScore = calculateCompositeScore(entry)
    const gradeInfo = getGrade(compositeScore)

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      compositeScore,
      ...gradeInfo,
      onTimeDeliveryRate: entry.onTimeDeliveryRate,
      qualityScore: entry.qualityScore,
      lastShipmentDelayDays: entry.lastShipmentDelayDays,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
      hasData: true,
    }
  })
}
