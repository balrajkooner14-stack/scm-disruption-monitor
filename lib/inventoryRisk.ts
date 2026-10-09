import { CompanyProfile, Supplier } from "@/lib/profile"
import { daysSinceLocalDate } from "@/lib/asOfDates"

export type RiskLevel = "critical" | "warning" | "safe" | "unknown"

export interface ProductRisk {
  productId: string
  productName: string
  inventoryDaysOnHand: number
  reorderPointDays: number
  daysRemaining: number
  primarySupplier: Supplier | null
  primaryLeadTimeDays: number
  backupSupplier: Supplier | null
  hsCode: string | null
  riskLevel: RiskLevel
  riskReason: string
  daysUntilStockout: number
  hasActiveDisruption: boolean
  progressPercent: number
  supplierAssigned: boolean
  /** false when the stock level was skipped (OnboardingExtras.inventoryUnknown). */
  stockKnown: boolean
  /** false when the primary supplier's lead time is 0, i.e. not entered. */
  leadTimeKnown: boolean
  /** YYYY-MM-DD the stock was counted, when recorded. */
  inventoryAsOf: string | null
}

/** v5.1 per-product stock dates. Omit it and the result is exactly as before. */
export interface InventoryRiskOptions {
  inventoryAsOf?: Record<string, string>
  inventoryUnknown?: string[]
  now?: Date
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
  daysSinceProfileUpdate: number = 0,
  opts?: InventoryRiskOptions
): InventorySnapshot {
  const products: ProductRisk[] = profile.productLines.map(product => {
    // Count down from this product's own stock date when one is recorded;
    // otherwise from the profile's last update (the pre-v5.1 behaviour).
    const asOf = opts?.inventoryAsOf?.[product.id] ?? null
    const elapsed = asOf ? daysSinceLocalDate(asOf, opts?.now) ?? daysSinceProfileUpdate : daysSinceProfileUpdate
    const stockKnown = !(opts?.inventoryUnknown ?? []).includes(product.id)
    const daysRemaining = stockKnown ? Math.max(0, product.inventoryDaysOnHand - elapsed) : 0

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

    // No sensible default for backup — unlike primary, which falls back to
    // the highest-share supplier, an unassigned backup should stay null
    // rather than guessing at one.
    const backupSupplier = product.backupSupplierId
      ? profile.suppliers.find(s => s.id === product.backupSupplierId) ?? null
      : null

    const hasActiveDisruption = primarySupplier
      ? (hasDisruptionByRegion[primarySupplier.region] ?? false)
      : false

    const daysUntilStockout = daysRemaining - product.reorderPointDays

    let riskLevel: RiskLevel = "safe"
    let riskReason = ""

    if (!stockKnown) {
      // No stock level: no risk level, no reorder recommendation, no banner.
      riskLevel = "unknown"
      riskReason = "Stock level not set"
    } else if (daysRemaining <= product.reorderPointDays) {
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
      backupSupplier,
      hsCode: product.hsCode ?? null,
      riskLevel,
      riskReason,
      daysUntilStockout,
      hasActiveDisruption,
      progressPercent,
      supplierAssigned: !!product.primarySupplierId,
      stockKnown,
      leadTimeKnown: !!primarySupplier && primarySupplier.leadTimeDays > 0,
      inventoryAsOf: asOf,
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
    case "critical": return "#B04A22"
    case "warning":  return "#C4973B"
    case "safe":     return "#3F6B4C"
    default:         return "#8A8272"
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
    urgencyColor = "text-ember"
  } else if (currentInventoryDays <= product.reorderPointDays + 7) {
    urgencyLabel = "Order This Week"
    urgencyColor = "text-ochre"
  } else {
    urgencyLabel = "Plan Ahead"
    urgencyColor = "text-sea-deep"
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
