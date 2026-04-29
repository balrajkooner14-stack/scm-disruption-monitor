import { Supplier } from "@/lib/profile"

export type ConcentrationLevel =
  | "diversified"   // HHI < 1500
  | "moderate"      // HHI 1500-2500
  | "concentrated"  // HHI 2500-5000
  | "critical"      // HHI > 5000

export interface ConcentrationBreakdown {
  byCountry: Array<{
    country: string
    totalShare: number
    supplierCount: number
  }>
  byRegion: Array<{
    region: string
    totalShare: number
    supplierCount: number
  }>
  largestSingleCountry: string
  largestCountryShare: number
  largestSingleRegion: string
  largestRegionShare: number
}

export interface ConcentrationRiskResult {
  hhi: number
  level: ConcentrationLevel
  label: string
  description: string
  recommendation: string
  colorClass: string
  bgClass: string
  borderClass: string
  breakdown: ConcentrationBreakdown
  supplierCount: number
  hasEnoughData: boolean
}

// HHI = sum of squared market shares (each 0-100)
// Max = 10,000 (single supplier at 100%)
export function calculateConcentrationRisk(
  suppliers: Supplier[]
): ConcentrationRiskResult {
  if (suppliers.length < 2) {
    return {
      hhi:
        suppliers.length === 1 ? Math.pow(suppliers[0].sharePercent, 2) : 0,
      level: "critical",
      label: "Insufficient Data",
      description: "Add at least 2 suppliers to calculate concentration risk.",
      recommendation:
        "Add more suppliers to your profile to enable risk scoring.",
      colorClass: "text-slate-400",
      bgClass: "bg-slate-800",
      borderClass: "border-slate-700",
      breakdown: buildBreakdown(suppliers),
      supplierCount: suppliers.length,
      hasEnoughData: false,
    }
  }

  const hhi = Math.round(
    suppliers.reduce((sum, s) => sum + Math.pow(s.sharePercent, 2), 0)
  )

  let level: ConcentrationLevel
  let label: string
  let description: string
  let recommendation: string
  let colorClass: string
  let bgClass: string
  let borderClass: string

  if (hhi < 1500) {
    level = "diversified"
    label = "Well Diversified"
    description = `Your supplier network has healthy diversification across ${suppliers.length} suppliers.`
    recommendation =
      "Maintain current diversification strategy and monitor lead time variability."
    colorClass = "text-green-400"
    bgClass = "bg-green-950"
    borderClass = "border-green-700"
  } else if (hhi < 2500) {
    level = "moderate"
    label = "Moderate Concentration"
    description =
      "Some concentration exists in your network — manageable with active monitoring."
    recommendation =
      "Consider qualifying backup suppliers in your highest-share regions."
    colorClass = "text-amber-400"
    bgClass = "bg-amber-950"
    borderClass = "border-amber-700"
  } else if (hhi < 5000) {
    level = "concentrated"
    label = "High Concentration"
    description =
      "Your network is concentrated — a single disruption could affect a large portion of supply."
    recommendation =
      "Prioritize supplier diversification in your top 2 supply regions."
    colorClass = "text-orange-400"
    bgClass = "bg-orange-950"
    borderClass = "border-orange-700"
  } else {
    level = "critical"
    label = "Critical Concentration"
    description =
      "Extreme concentration — your supply chain is highly vulnerable to single-point failures."
    recommendation =
      "Immediately begin qualifying alternative suppliers to reduce single-source dependency."
    colorClass = "text-red-400"
    bgClass = "bg-red-950"
    borderClass = "border-red-700"
  }

  return {
    hhi,
    level,
    label,
    description,
    recommendation,
    colorClass,
    bgClass,
    borderClass,
    breakdown: buildBreakdown(suppliers),
    supplierCount: suppliers.length,
    hasEnoughData: true,
  }
}

function buildBreakdown(suppliers: Supplier[]): ConcentrationBreakdown {
  const countryMap = new Map<string, { share: number; count: number }>()
  const regionMap = new Map<string, { share: number; count: number }>()

  suppliers.forEach(s => {
    const existing = countryMap.get(s.country) ?? { share: 0, count: 0 }
    countryMap.set(s.country, {
      share: existing.share + s.sharePercent,
      count: existing.count + 1,
    })
    const existingRegion = regionMap.get(s.region) ?? { share: 0, count: 0 }
    regionMap.set(s.region, {
      share: existingRegion.share + s.sharePercent,
      count: existingRegion.count + 1,
    })
  })

  const byCountry = Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      totalShare: Math.round(data.share),
      supplierCount: data.count,
    }))
    .sort((a, b) => b.totalShare - a.totalShare)

  const byRegion = Array.from(regionMap.entries())
    .map(([region, data]) => ({
      region,
      totalShare: Math.round(data.share),
      supplierCount: data.count,
    }))
    .sort((a, b) => b.totalShare - a.totalShare)

  return {
    byCountry,
    byRegion,
    largestSingleCountry: byCountry[0]?.country ?? "N/A",
    largestCountryShare: byCountry[0]?.totalShare ?? 0,
    largestSingleRegion: byRegion[0]?.region ?? "N/A",
    largestRegionShare: byRegion[0]?.totalShare ?? 0,
  }
}
