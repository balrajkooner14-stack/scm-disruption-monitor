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
