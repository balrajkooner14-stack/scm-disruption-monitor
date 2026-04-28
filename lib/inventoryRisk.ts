import { CompanyProfile, Supplier } from "@/lib/profile"

export type RiskLevel = "critical" | "warning" | "safe" | "unknown"

export interface ProductRisk {
  productId: string
  productName: string
  inventoryDaysOnHand: number
  reorderPointDays: number
  daysRemaining: number
  primarySupplier: Supplier | null
  primaryLeadTimeDays: number
  riskLevel: RiskLevel
  riskReason: string
  daysUntilStockout: number
  hasActiveDisruption: boolean
  progressPercent: number
}

export interface InventorySnapshot {
  products: ProductRisk[]
  criticalCount: number
  warningCount: number
  safeCount: number
  lastCalculated: string
}

export function calculateInventoryRisk(
  profile: CompanyProfile,
  hasDisruptionByRegion: Record<string, boolean>,
  daysSinceProfileUpdate: number = 0
): InventorySnapshot {
  const products: ProductRisk[] = profile.productLines.map(product => {
    const daysRemaining = Math.max(
      0,
      product.inventoryDaysOnHand - daysSinceProfileUpdate
    )

    const primarySupplier = profile.suppliers.length > 0
      ? profile.suppliers.reduce((a, b) =>
          a.sharePercent > b.sharePercent ? a : b
        )
      : null

    const primaryLeadTimeDays = primarySupplier?.leadTimeDays ?? 30

    const hasActiveDisruption = primarySupplier
      ? (hasDisruptionByRegion[primarySupplier.region] ?? false)
      : false

    const daysUntilStockout = daysRemaining - product.reorderPointDays

    let riskLevel: RiskLevel = "safe"
    let riskReason = ""

    if (daysRemaining <= product.reorderPointDays) {
      riskLevel = "critical"
      riskReason = hasActiveDisruption
        ? `Reorder point reached — active disruption in ${primarySupplier?.region} extends lead time risk`
        : `Reorder point reached — order now to avoid stockout`
    } else if (daysRemaining <= product.reorderPointDays + primaryLeadTimeDays) {
      riskLevel = "warning"
      riskReason = hasActiveDisruption
        ? `Approaching reorder point with active disruption in ${primarySupplier?.region}`
        : `Within lead time window — monitor closely`
    } else if (hasActiveDisruption) {
      riskLevel = "warning"
      riskReason = `Active disruption in ${primarySupplier?.region} may extend lead times — consider ordering early`
    } else {
      riskLevel = "safe"
      riskReason = `Inventory adequate — ${daysRemaining} days on hand`
    }

    const maxDays = Math.max(
      product.inventoryDaysOnHand,
      product.reorderPointDays + primaryLeadTimeDays + 10
    )
    const progressPercent = Math.round(
      Math.min(100, (daysRemaining / maxDays) * 100)
    )

    return {
      productId: product.id,
      productName: product.name,
      inventoryDaysOnHand: product.inventoryDaysOnHand,
      reorderPointDays: product.reorderPointDays,
      daysRemaining,
      primarySupplier,
      primaryLeadTimeDays,
      riskLevel,
      riskReason,
      daysUntilStockout,
      hasActiveDisruption,
      progressPercent,
    }
  })

  return {
    products,
    criticalCount: products.filter(p => p.riskLevel === "critical").length,
    warningCount: products.filter(p => p.riskLevel === "warning").length,
    safeCount: products.filter(p => p.riskLevel === "safe").length,
    lastCalculated: new Date().toISOString(),
  }
}

export function getDaysSinceDate(isoDateString: string): number {
  const then = new Date(isoDateString)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function getInventoryBarColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "critical": return "#ef4444"
    case "warning":  return "#f59e0b"
    case "safe":     return "#22c55e"
    default:         return "#94a3b8"
  }
}
