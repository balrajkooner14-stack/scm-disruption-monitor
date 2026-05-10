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
  supplierAssigned: boolean
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

    const primarySupplier = (() => {
      if (product.primarySupplierId) {
        const assigned = profile.suppliers.find(
          s => s.id === product.primarySupplierId
        )
        if (assigned) return assigned
      }
      return profile.suppliers.length > 0
        ? profile.suppliers.reduce((a, b) =>
            a.sharePercent > b.sharePercent ? a : b
          )
        : null
    })()

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
      supplierAssigned: !!product.primarySupplierId,
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

export interface OrderRecommendation {
  recommendedOrderQty: number
  dailyConsumptionRate: number
  safetyStockDays: number
  coverageDays: number
  urgencyLabel: "Order Today" | "Order This Week" | "Plan Ahead"
  urgencyColor: string
  rationale: string
}

const SAFETY_STOCK_DAYS: Record<RiskLevel, number> = {
  critical: 30,
  warning: 21,
  safe: 14,
  unknown: 14,
}

export function calculateOrderRecommendation(
  product: ProductRisk,
): OrderRecommendation | null {
  if (product.riskLevel === "safe" || product.riskLevel === "unknown") {
    return null
  }

  const leadTimeDays = product.primaryLeadTimeDays
  const currentInventoryDays = product.daysRemaining
  const safetyStockDays = SAFETY_STOCK_DAYS[product.riskLevel]

  const daysOfSupplyToOrder = Math.max(
    0,
    leadTimeDays + safetyStockDays - currentInventoryDays
  )

  const coverageDays = leadTimeDays + safetyStockDays

  let urgencyLabel: OrderRecommendation["urgencyLabel"]
  let urgencyColor: string

  if (currentInventoryDays <= product.reorderPointDays) {
    urgencyLabel = "Order Today"
    urgencyColor = "text-red-400"
  } else if (currentInventoryDays <= product.reorderPointDays + 7) {
    urgencyLabel = "Order This Week"
    urgencyColor = "text-amber-400"
  } else {
    urgencyLabel = "Plan Ahead"
    urgencyColor = "text-yellow-400"
  }

  const rationale =
    `Covers ${leadTimeDays}-day lead time from ` +
    `${product.primarySupplier?.name ?? "primary supplier"} ` +
    `plus ${safetyStockDays}-day safety stock buffer.`

  return {
    recommendedOrderQty: daysOfSupplyToOrder,
    dailyConsumptionRate: 0,
    safetyStockDays,
    coverageDays,
    urgencyLabel,
    urgencyColor,
    rationale,
  }
}
